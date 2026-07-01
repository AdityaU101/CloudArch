import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetArchitecture, useUpdateArchitecture, getGetArchitectureQueryKey, getListArchitecturesQueryKey, getGetArchitectureStatsQueryKey } from "@workspace/api-client-react";
import { ArchitectureViewer } from "@/components/architecture-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Edit2, Check, X, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ArchitectureDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: architecture, isLoading, error } = useGetArchitecture(id, {
    query: { enabled: !!id, queryKey: getGetArchitectureQueryKey(id) }
  });
  
  const updateMutation = useUpdateArchitecture();

  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  useEffect(() => {
    if (architecture?.title) {
      setTitleInput(architecture.title);
    }
  }, [architecture]);

  const handleUpdateTitle = () => {
    if (!titleInput.trim() || titleInput === architecture?.title) {
      setIsEditing(false);
      return;
    }
    
    updateMutation.mutate(
      { id, data: { title: titleInput } },
      {
        onSuccess: (data) => {
          setIsEditing(false);
          // Patch cache locally
          queryClient.setQueryData(getGetArchitectureQueryKey(id), (old: any) => 
            old ? { ...old, title: data.title } : old
          );
          queryClient.invalidateQueries({ queryKey: getListArchitecturesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetArchitectureStatsQueryKey() });
          toast({ title: "Title Updated" });
        },
        onError: () => {
          toast({ title: "Update Failed", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !architecture) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Architecture Not Found</h2>
        <Button asChild variant="outline">
          <Link href="/architectures">Back to List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" asChild>
          <Link href="/architectures"><ChevronLeft className="mr-2 h-4 w-4" /> Back to Architectures</Link>
        </Button>
        
        <div className="flex items-center gap-4">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Input 
                value={titleInput} 
                onChange={(e) => setTitleInput(e.target.value)} 
                className="text-2xl font-bold h-auto py-1"
                autoFocus
              />
              <Button size="icon" variant="ghost" onClick={handleUpdateTitle} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { setIsEditing(false); setTitleInput(architecture.title); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4 group">
              <h1 className="text-3xl font-bold tracking-tight">{architecture.title}</h1>
              <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <ArchitectureViewer architecture={architecture} isDetail={true} />
    </div>
  );
}
