import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVersions,
  useGetVersion,
  useRollbackToVersion,
  getListVersionsQueryKey,
  getGetVersionQueryKey,
  getGetArchitectureQueryKey,
  getListAuditLogsQueryKey,
  type ArchitectureVersionSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { diffLines, collapseUnchanged, canDiff, type DiffRow } from "@/lib/text-diff";
import { cn } from "@/lib/utils";
import { History, GitCompareArrows, Undo2, Loader2, X } from "lucide-react";

const SECTION_LABELS: Record<string, string> = {
  title: "Title",
  requirements: "Requirements",
  provider: "Provider",
  diagram: "Diagram",
  terraform: "Terraform",
  costEstimate: "Cost Estimate",
  securityRecommendations: "Security",
  highAvailabilityPlan: "High Availability",
  databaseRecommendation: "Database",
  kubernetesDeployment: "Kubernetes",
  cicdPipeline: "CI/CD",
  monitoringSetup: "Monitoring",
  disasterRecovery: "Disaster Recovery",
  threatModel: "Threat Model",
};

function timeAgo(iso: string | Date): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function DiffPane({ rows }: { rows: (DiffRow | { collapsed: number })[] }) {
  return (
    <div className="grid grid-cols-2 overflow-x-auto font-mono text-[11px] leading-relaxed">
      {rows.map((row, i) =>
        "collapsed" in row ? (
          <div key={i} className="col-span-2 border-y border-border bg-muted/40 px-3 py-1 text-center text-muted-foreground">
            ⋯ {row.collapsed} unchanged line{row.collapsed === 1 ? "" : "s"} ⋯
          </div>
        ) : (
          <div key={i} className="col-span-2 grid grid-cols-2">
            <div
              className={cn(
                "whitespace-pre-wrap break-all border-r border-border px-3",
                row.type === "removed" || row.type === "changed" ? "bg-red-500/10 text-red-200" : "text-muted-foreground",
              )}
            >
              {row.left ?? " "}
            </div>
            <div
              className={cn(
                "whitespace-pre-wrap break-all px-3",
                row.type === "added" || row.type === "changed" ? "bg-emerald-500/10 text-emerald-200" : "text-muted-foreground",
              )}
            >
              {row.right ?? " "}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

interface VersionHistoryProps {
  architectureId: number;
  /** Current values of the content fields, used as the right side of a compare. */
  current: Record<string, string | undefined>;
}

/**
 * The History tab: version list, side-by-side compare (any version against the
 * current state, or two versions against each other), and rollback.
 */
export function VersionHistory({ architectureId, current }: VersionHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: versions, isLoading } = useListVersions(architectureId, {
    query: { queryKey: getListVersionsQueryKey(architectureId) },
  });

  const [compareIds, setCompareIds] = useState<number[]>([]); // 1 = vs current, 2 = vs each other
  const [section, setSection] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<ArchitectureVersionSummary | null>(null);

  // Oldest selected id becomes the "before" side.
  const sorted = useMemo(() => {
    if (!versions) return [] as ArchitectureVersionSummary[];
    return [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  }, [versions]);

  const beforeId = compareIds.length ? Math.min(...compareIds) : undefined;
  const afterId = compareIds.length === 2 ? Math.max(...compareIds) : undefined;

  const beforeQuery = useGetVersion(architectureId, beforeId ?? 0, {
    query: { enabled: beforeId !== undefined, queryKey: getGetVersionQueryKey(architectureId, beforeId ?? 0) },
  });
  const afterQuery = useGetVersion(architectureId, afterId ?? 0, {
    query: { enabled: afterId !== undefined, queryKey: getGetVersionQueryKey(architectureId, afterId ?? 0) },
  });

  const rollbackMutation = useRollbackToVersion();

  const toggleCompare = (id: number) => {
    setSection(null);
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id],
    );
  };

  const doRollback = () => {
    if (!rollbackTarget) return;
    rollbackMutation.mutate(
      { id: architectureId, versionId: rollbackTarget.id },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetArchitectureQueryKey(architectureId), data);
          queryClient.invalidateQueries({ queryKey: getListVersionsQueryKey(architectureId) });
          queryClient.invalidateQueries({ queryKey: getListAuditLogsQueryKey() });
          toast({ title: `Rolled back to v${rollbackTarget.versionNumber}` });
          setRollbackTarget(null);
          setCompareIds([]);
        },
        onError: () => toast({ title: "Rollback failed", variant: "destructive" }),
      },
    );
  };

  // --- compare panel data ---
  const beforeVersion = beforeQuery.data;
  const afterVersion = afterQuery.data;
  const compareReady =
    beforeId !== undefined && beforeVersion && (afterId === undefined || afterVersion);

  const sectionsAvailable = useMemo(() => {
    if (!compareReady || !beforeVersion) return [];
    const before = beforeVersion.snapshot ?? {};
    const after = afterId !== undefined ? (afterVersion?.snapshot ?? {}) : current;
    return Object.keys(SECTION_LABELS).filter((key) => {
      const a = before[key] ?? "";
      const b = (after as Record<string, string | undefined>)[key] ?? "";
      return a !== b;
    });
  }, [compareReady, beforeVersion, afterVersion, afterId, current]);

  const activeSection = section ?? sectionsAvailable[0] ?? null;
  const compareRows = useMemo(() => {
    if (!compareReady || !beforeVersion || !activeSection) return null;
    const a = beforeVersion.snapshot?.[activeSection] ?? "";
    const b =
      afterId !== undefined
        ? (afterVersion?.snapshot?.[activeSection] ?? "")
        : (current[activeSection] ?? "");
    if (!canDiff(a, b)) return null;
    return collapseUnchanged(diffLines(a, b));
  }, [compareReady, beforeVersion, afterVersion, afterId, activeSection, current]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <History className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No versions yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            A version is captured automatically whenever this architecture changes — renames, section edits,
            regenerations, and rollbacks.
          </p>
        </CardContent>
      </Card>
    );
  }

  const beforeLabel = beforeVersion ? `v${beforeVersion.versionNumber}` : "";
  const afterLabel = afterId !== undefined && afterVersion ? `v${afterVersion.versionNumber}` : "current";

  return (
    <div className="space-y-4">
      {/* Compare panel */}
      {compareIds.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <GitCompareArrows className="h-4 w-4 text-primary" />
                Comparing {beforeLabel} → {afterLabel}
              </CardTitle>
              <div className="flex items-center gap-2">
                {sectionsAvailable.length > 0 && (
                  <Select value={activeSection ?? undefined} onValueChange={setSection}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectionsAvailable.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {SECTION_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCompareIds([])}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              {compareIds.length === 1
                ? "Comparing against the current state. Select a second version to compare two snapshots."
                : "Comparing two saved snapshots."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!compareReady ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading snapshots…
              </div>
            ) : sectionsAvailable.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">These two states are identical.</p>
            ) : compareRows ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-2 border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <div className="border-r border-border px-3 py-1.5">{beforeLabel}</div>
                  <div className="px-3 py-1.5">{afterLabel}</div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <DiffPane rows={compareRows} />
                </div>
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">
                This section is too large to diff line-by-line; roll back or open the version to view it whole.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Version list */}
      <div className="space-y-2">
        {sorted.map((v) => {
          const selected = compareIds.includes(v.id);
          return (
            <div
              key={v.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 px-4 py-3 transition-colors",
                selected ? "border-primary/50" : "border-border",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                v{v.versionNumber}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{v.reason}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{v.editorName ?? "Unknown"}</span>
                  <span className="opacity-50">·</span>
                  <span>{timeAgo(v.createdAt as unknown as string)}</span>
                  {(v.changedFields ?? []).slice(0, 4).map((f) => (
                    <Badge key={f} variant="outline" className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
                      {SECTION_LABELS[f] ?? f}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant={selected ? "secondary" : "ghost"}
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => toggleCompare(v.id)}
                >
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  {selected ? "Selected" : "Compare"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setRollbackTarget(v)}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Roll back
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rollback confirm */}
      <AlertDialog open={rollbackTarget !== null} onOpenChange={(o) => !o && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back to v{rollbackTarget?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              The architecture will be restored to the state captured in this version
              {rollbackTarget?.changedFields?.length
                ? ` (${rollbackTarget.changedFields.map((f) => SECTION_LABELS[f] ?? f).join(", ")})`
                : ""}
              . The current state is saved as a new version first, so this is reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRollback} disabled={rollbackMutation.isPending}>
              {rollbackMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              Roll back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
