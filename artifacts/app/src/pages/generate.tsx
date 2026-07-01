import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchitectureViewer } from "@/components/architecture-viewer";
import { useSaveArchitecture, getListArchitecturesQueryKey, getGetArchitectureStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Server, Loader2, Save } from "lucide-react";

export default function Generate() {
  const [requirements, setRequirements] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<any | null>(null);
  
  const saveMutation = useSaveArchitecture();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleGenerate = async () => {
    if (!requirements.trim()) return;
    
    setIsGenerating(true);
    setStreamText("");
    setResult(null);
    
    try {
      const response = await fetch("/api/architectures/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements }),
      });
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "chunk") {
                setStreamText(prev => prev + event.chunk);
              } else if (event.type === "done") {
                setResult(event.result);
              } else if (event.type === "error") {
                toast({
                  title: "Generation Failed",
                  description: event.error,
                  variant: "destructive",
                });
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks if any
            }
          }
        }
      }
    } catch (error) {
      toast({
        title: "Generation Error",
        description: "Failed to connect to the generation service.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!result) return;
    
    // Add title derived from requirements if not present
    const title = result.title || requirements.split(" ").slice(0, 5).join(" ") + "...";
    
    saveMutation.mutate(
      { data: { ...result, title, requirements } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListArchitecturesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetArchitectureStatsQueryKey() });
          toast({
            title: "Architecture Saved",
            description: "Successfully saved to your library.",
          });
          setLocation("/architectures");
        },
        onError: () => {
          toast({
            title: "Save Failed",
            description: "Failed to save the architecture.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Generate Architecture</h1>
        <p className="text-muted-foreground">Describe your application in plain English, and our AI solutions architect will design the AWS infrastructure.</p>
      </div>

      <Card className="border-primary/20 shadow-sm bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            System Requirements
          </CardTitle>
          <CardDescription>Be as detailed as possible about scale, security, and compliance needs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="e.g. A multi-tenant SaaS application that processes 10,000 video uploads per day. We need high availability, auto-scaling, and a PostgreSQL database. Must comply with SOC2."
            className="min-h-[150px] font-mono text-sm bg-zinc-950/50"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !requirements.trim()}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Designing Infrastructure...
              </>
            ) : (
              "Generate Architecture"
            )}
          </Button>
        </CardContent>
      </Card>

      {isGenerating && !result && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-primary flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              STREAMING THOUGHTS...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-zinc-950 p-4 rounded-md overflow-y-auto max-h-[300px] font-mono text-xs text-muted-foreground whitespace-pre-wrap">
              {streamText || "Connecting to AI architect..."}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Generated Design</h2>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Architecture
            </Button>
          </div>
          <ArchitectureViewer architecture={result} />
        </div>
      )}
    </div>
  );
}
