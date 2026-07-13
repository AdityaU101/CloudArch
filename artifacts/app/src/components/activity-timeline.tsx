import { useListAuditLogs, getListAuditLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  FilePlus2,
  PencilLine,
  RefreshCcw,
  Trash2,
  Download,
  ShieldCheck,
  Undo2,
  LogIn,
  UserPlus,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const ACTION_META: Record<string, { icon: LucideIcon; hue: string; describe: (meta: Record<string, unknown>) => string }> = {
  "architecture.create": { icon: FilePlus2, hue: "150 70% 45%", describe: (m) => `Saved "${m.title ?? "architecture"}" to the library` },
  "architecture.generate": { icon: Wand2, hue: "36 100% 50%", describe: (m) => `Generated a ${String(m.provider ?? "cloud").toUpperCase()} design` },
  "architecture.rename": { icon: PencilLine, hue: "200 90% 48%", describe: (m) => `Renamed "${m.from ?? "…"}" to "${m.to ?? "…"}"` },
  "architecture.update": { icon: PencilLine, hue: "200 90% 48%", describe: (m) => `Edited ${(m.fields as string[] | undefined)?.join(", ") ?? "content"}` },
  "architecture.regenerate_section": { icon: RefreshCcw, hue: "268 78% 62%", describe: (m) => `Regenerated the ${m.section ?? "?"} section` },
  "architecture.rollback": { icon: Undo2, hue: "268 78% 62%", describe: (m) => `Rolled back to v${m.toVersion ?? "?"}` },
  "architecture.delete": { icon: Trash2, hue: "0 78% 62%", describe: (m) => `Deleted "${m.title ?? "architecture"}"` },
  "terraform.export": { icon: Download, hue: "150 70% 45%", describe: () => "Downloaded Terraform" },
  "validation.run": { icon: ShieldCheck, hue: "340 78% 62%", describe: (m) => `Validated ${m.format ?? "IaC"} source` },
  "auth.login": { icon: LogIn, hue: "190 12% 60%", describe: () => "Signed in" },
  "auth.register": { icon: UserPlus, hue: "190 12% 60%", describe: () => "Created account" },
};

function timeAgo(iso: string | Date): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface ActivityTimelineProps {
  /** Limit the trail to one architecture; omit for workspace-wide activity. */
  architectureId?: number;
}

/** Read-only audit trail rendered as a compact timeline. */
export function ActivityTimeline({ architectureId }: ActivityTimelineProps) {
  const params = architectureId !== undefined ? { architectureId } : undefined;
  const { data: entries, isLoading } = useListAuditLogs(params, {
    query: { queryKey: getListAuditLogsQueryKey(params) },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!entries?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Activity className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Actions like saves, edits, regenerations, exports, and rollbacks are recorded here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative space-y-0 pl-1">
      {entries.map((entry, i) => {
        const meta = ACTION_META[entry.actionType] ?? {
          icon: Activity,
          hue: "190 12% 60%",
          describe: () => entry.actionType,
        };
        const Icon = meta.icon;
        return (
          <div key={entry.id} className="relative flex gap-3 pb-5">
            {/* rail */}
            {i < entries.length - 1 && (
              <span className="absolute left-[15px] top-8 h-full w-px bg-border" aria-hidden />
            )}
            <div
              className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card"
              style={{ color: `hsl(${meta.hue})` }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm text-foreground">{meta.describe((entry.metadata ?? {}) as Record<string, unknown>)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {entry.userName ?? "Unknown"} · {timeAgo(entry.createdAt as unknown as string)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
