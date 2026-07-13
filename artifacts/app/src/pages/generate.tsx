import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchitectureViewer } from "@/components/architecture-viewer";
import { useSaveArchitecture, getListArchitecturesQueryKey, getGetArchitectureStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { streamJsonEvents } from "@/lib/sse-stream";
import { CLOUD_PROVIDERS, providerMeta, type CloudProvider } from "@/lib/cloud-providers";
import { scanContent, scanFields, redactContent, redactFields, type SecretFinding } from "@workspace/secret-scan";
import { SecretWarningDialog } from "@/components/secret-warning-dialog";
import { cn } from "@/lib/utils";
import { Server, Loader2, Save, Sparkles, Wand2 } from "lucide-react";

const EXAMPLES = [
  "A multi-tenant SaaS that processes 10k video uploads/day with auto-scaling and SOC2 compliance.",
  "A low-latency e-commerce API for 1M users with a PostgreSQL database and global CDN.",
  "An event-driven data pipeline ingesting IoT telemetry with real-time dashboards.",
];

export default function Generate() {
  const [requirements, setRequirements] = useState("");
  const [provider, setProvider] = useState<CloudProvider>("aws");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [scanState, setScanState] = useState<{ findings: SecretFinding[]; action: "generate" | "save" } | null>(null);

  const saveMutation = useSaveArchitecture();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleGenerate = async (text?: string) => {
    const reqs = text ?? requirements;
    if (!reqs.trim()) return;

    // Local scan before anything leaves the browser.
    if (text === undefined) {
      const findings = scanContent(reqs, "requirements");
      if (findings.length > 0) {
        setScanState({ findings, action: "generate" });
        return;
      }
    }

    setIsGenerating(true);
    setStreamText("");
    setResult(null);
    
    try {
      await streamJsonEvents<any>(
        "/api/architectures/generate",
        { requirements: reqs, provider },
        {
          onChunk: (content) => setStreamText((prev) => prev + content),
          onDone: (result) => setResult(result),
          onError: (error) =>
            toast({
              title: "Generation Failed",
              description: error,
              variant: "destructive",
            }),
        },
      );
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

  const handleSave = (payload?: Record<string, any>) => {
    if (!result && !payload) return;

    const base = payload ?? { ...result, requirements };

    // Scan everything that would be persisted (only on the unscanned path).
    if (!payload) {
      const findings = scanFields({
        requirements: base.requirements,
        diagram: base.diagram,
        terraform: base.terraform,
        costEstimate: base.costEstimate,
        securityRecommendations: base.securityRecommendations,
        highAvailabilityPlan: base.highAvailabilityPlan,
        databaseRecommendation: base.databaseRecommendation,
        kubernetesDeployment: base.kubernetesDeployment,
        cicdPipeline: base.cicdPipeline,
        monitoringSetup: base.monitoringSetup,
        disasterRecovery: base.disasterRecovery,
        threatModel: base.threatModel,
      });
      if (findings.length > 0) {
        setScanState({ findings, action: "save" });
        return;
      }
    }

    // Add title derived from requirements if not present
    const title = base.title || requirements.split(" ").slice(0, 5).join(" ") + "...";

    saveMutation.mutate(
      { data: { ...base, title } },
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

  const resolveScan = (mode: "redact" | "proceed") => {
    if (!scanState) return;
    const { findings, action } = scanState;
    setScanState(null);

    if (action === "generate") {
      const text = mode === "redact" ? redactContent(requirements, findings) : requirements;
      if (mode === "redact") setRequirements(text);
      handleGenerate(text);
    } else {
      const base = { ...result, requirements };
      const payload = mode === "redact" ? redactFields(base, findings) : base;
      if (mode === "redact") {
        const { requirements: redactedReqs, ...redactedResult } = payload;
        setResult(redactedResult);
        setRequirements(redactedReqs ?? requirements);
      }
      handleSave(payload);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <SecretWarningDialog
        open={scanState !== null}
        findings={scanState?.findings ?? []}
        actionLabel={scanState?.action === "save" ? "saving to your library" : "sending to the AI architect"}
        onCancel={() => setScanState(null)}
        onRedact={() => resolveScan("redact")}
        onProceed={() => resolveScan("proceed")}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          AI Solutions Architect
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Design your cloud architecture</h1>
        <p className="max-w-2xl text-muted-foreground">
          Describe your application in plain English. Get a costed, editable {providerMeta(provider).name} design with security, scaling, and disaster-recovery guidance.
        </p>
      </motion.div>

      <Card className="overflow-hidden border-primary/15 bg-card/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            System requirements
          </CardTitle>
          <CardDescription>Include scale, traffic, data, security, and compliance needs for the best result.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Target cloud</span>
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
              {CLOUD_PROVIDERS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProvider(id)}
                  disabled={isGenerating}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    provider === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", provider === id && "text-primary")} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            placeholder="e.g. A multi-tenant SaaS application that processes 10,000 video uploads per day. We need high availability, auto-scaling, and a PostgreSQL database. Must comply with SOC2."
            className="min-h-[150px] resize-none bg-background/60 font-mono text-sm"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />

          {!requirements && !isGenerating && (
            <div className="flex flex-wrap gap-2">
              <span className="py-1 text-xs text-muted-foreground">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setRequirements(ex)}
                  className="hover-elevate rounded-full border border-border bg-muted/40 px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {ex.length > 52 ? ex.slice(0, 52) + "…" : ex}
                </button>
              ))}
            </div>
          )}

          <Button onClick={() => handleGenerate()} disabled={isGenerating || !requirements.trim()} className="w-full gap-2 sm:w-auto">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Designing infrastructure…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate architecture
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {isGenerating && !result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-mono text-sm text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Streaming design decisions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-md bg-background/70 p-4 font-mono text-xs text-muted-foreground">
                  {streamText || "Connecting to AI architect…"}
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary/70 align-middle" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Generated design</h2>
              <Button onClick={() => handleSave()} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save architecture
              </Button>
            </div>
            <ArchitectureViewer architecture={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
