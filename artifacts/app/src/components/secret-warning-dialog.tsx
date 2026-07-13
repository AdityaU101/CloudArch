import type { SecretFinding } from "@workspace/secret-scan";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertTriangle, Eraser, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecretWarningDialogProps {
  open: boolean;
  findings: SecretFinding[];
  /** What the user was about to do, e.g. "generating", "saving", "validating". */
  actionLabel: string;
  onCancel: () => void;
  onRedact: () => void;
  onProceed: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  requirements: "Requirements",
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
  source: "Source",
};

/**
 * Shown when a local scan finds secret-like content before it would be sent or
 * stored. The user decides: redact automatically, proceed as-is, or cancel.
 */
export function SecretWarningDialog({
  open,
  findings,
  actionLabel,
  onCancel,
  onRedact,
  onProceed,
}: SecretWarningDialogProps) {
  const criticalCount = findings.filter((f) => f.severity === "critical").length;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Possible secrets detected
          </AlertDialogTitle>
          <AlertDialogDescription>
            {findings.length} sensitive-looking value{findings.length === 1 ? "" : "s"}
            {criticalCount > 0 && ` (${criticalCount} high-confidence)`} found before {actionLabel}. The scan runs
            locally — nothing has been sent anywhere yet.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {findings.slice(0, 20).map((f) => (
            <div
              key={f.id}
              className={cn(
                "flex items-start gap-2 rounded-lg border bg-card/60 px-3 py-2",
                f.severity === "critical" ? "border-destructive/40" : "border-border",
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  f.severity === "critical" ? "text-destructive" : "text-yellow-500",
                )}
              />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-xs font-medium text-foreground">{f.label}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{f.preview}</div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {(f.field && FIELD_LABELS[f.field]) ?? f.field ?? "content"} · L{f.line}
              </span>
            </div>
          ))}
          {findings.length > 20 && (
            <p className="px-1 text-[11px] text-muted-foreground">…and {findings.length - 20} more.</p>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button variant="outline" onClick={onProceed} className="gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" /> Proceed anyway
          </Button>
          <Button onClick={onRedact} className="gap-1.5">
            <Eraser className="h-3.5 w-3.5" /> Redact & continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
