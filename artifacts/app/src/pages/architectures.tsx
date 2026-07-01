import { useListArchitectures, useGetArchitectureStats, useDeleteArchitecture, getListArchitecturesQueryKey, getGetArchitectureStatsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink, Activity, Database, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Architectures() {
  const { data: stats, isLoading: statsLoading } = useGetArchitectureStats();
  const { data: architectures, isLoading: archLoading } = useListArchitectures();
  const deleteMutation = useDeleteArchitecture();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Architecture Deleted" });
          queryClient.invalidateQueries({ queryKey: getListArchitecturesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetArchitectureStatsQueryKey() });
        },
        onError: () => {
          toast({ title: "Deletion Failed", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Saved Architectures</h1>
        <p className="text-muted-foreground">Library of previously generated infrastructure designs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Database className="h-4 w-4" /> Total Designs</CardDescription>
            <CardTitle className="text-4xl">{statsLoading ? <Skeleton className="h-10 w-16" /> : stats?.totalCount || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Activity className="h-4 w-4" /> Last 7 Days</CardDescription>
            <CardTitle className="text-4xl">{statsLoading ? <Skeleton className="h-10 w-16" /> : stats?.recentCount || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Clock className="h-4 w-4" /> Latest Design</CardDescription>
            <CardTitle className="text-xl truncate">{statsLoading ? <Skeleton className="h-6 w-32" /> : stats?.latestTitle || "None"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-4">
        {archLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))
        ) : architectures?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No architectures saved</p>
              <p className="text-sm text-muted-foreground mb-4">Generate your first cloud architecture to see it here.</p>
              <Button asChild>
                <Link href="/">Generate Now</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {architectures?.map((arch) => (
              <Card key={arch.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg mb-1">{arch.title}</CardTitle>
                      <CardDescription>{format(new Date(arch.createdAt), "MMM d, yyyy")}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/architectures/${arch.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Architecture?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the architecture design.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(arch.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{arch.requirements}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
