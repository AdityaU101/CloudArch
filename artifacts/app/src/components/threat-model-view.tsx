import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Crosshair,
  ShieldAlert,
  ShieldCheck,
  Users,
  Waypoints,
  Zap,
} from "lucide-react";

interface StrideEntry {
  category?: string;
  threat?: string;
  component?: string;
  mitigation?: string;
}

interface RiskEntry {
  risk?: string;
  likelihood?: string;
  impact?: string;
  severity?: string;
}

interface Mitigation {
  recommendation?: string;
  service?: string;
}

interface ThreatModel {
  attackSurface?: string;
  trustBoundaries?: string[];
  threatActors?: string[];
  attackVectors?: string[];
  stride?: StrideEntry[];
  riskMatrix?: RiskEntry[];
  mitigations?: Mitigation[];
}

function parseThreatModel(raw?: string): ThreatModel | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/15 text-red-400",
  high: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  medium: "border-yellow-500/30 bg-yellow-500/15 text-yellow-400",
  low: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
};

export function SeverityBadge({ level }: { level?: string }) {
  const key = (level ?? "").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[11px] uppercase", SEVERITY_STYLES[key] ?? "text-muted-foreground")}
    >
      {level || "—"}
    </Badge>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Crosshair;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">None identified.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * Renders the structured STRIDE threat model generated alongside the
 * architecture. Falls back to plain text if the stored value isn't JSON
 * (e.g. architectures saved before threat modeling existed).
 */
export function ThreatModelView({ threatModel }: { threatModel?: string }) {
  const model = parseThreatModel(threatModel);

  if (!model) {
    if (threatModel?.trim()) {
      return <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{threatModel}</div>;
    }
    return (
      <p className="text-sm text-muted-foreground">
        No threat model generated. Re-generate this architecture to include a STRIDE analysis.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard icon={Crosshair} title="Attack Surface" description="Externally reachable components and exposure summary.">
        <p className="text-sm leading-relaxed">{model.attackSurface || "No summary generated."}</p>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={Waypoints} title="Trust Boundaries" description="Where data crosses privilege or network boundaries.">
          <BulletList items={model.trustBoundaries} />
        </SectionCard>
        <SectionCard icon={Users} title="Threat Actors" description="Who is likely to target this system, and why.">
          <BulletList items={model.threatActors} />
        </SectionCard>
      </div>

      <SectionCard icon={Zap} title="Attack Vectors" description="Concrete paths an attacker could take against this design.">
        <BulletList items={model.attackVectors} />
      </SectionCard>

      <SectionCard icon={ShieldAlert} title="STRIDE Analysis" description="Threats by category with component-level mitigations.">
        {model.stride?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Threat</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>Mitigation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.stride.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap font-medium">{entry.category}</TableCell>
                    <TableCell className="min-w-[180px]">{entry.threat}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{entry.component}</TableCell>
                    <TableCell className="min-w-[220px] text-muted-foreground">{entry.mitigation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No STRIDE entries generated.</p>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={ShieldAlert} title="Risk Matrix" description="Likelihood × impact for the highest-priority risks.">
          {model.riskMatrix?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Likelihood</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.riskMatrix.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="min-w-[140px] font-medium">{entry.risk}</TableCell>
                    <TableCell>{entry.likelihood}</TableCell>
                    <TableCell>{entry.impact}</TableCell>
                    <TableCell><SeverityBadge level={entry.severity} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No risk matrix generated.</p>
          )}
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="Mitigations" description="Recommended controls mapped to cloud-native services.">
          {model.mitigations?.length ? (
            <ul className="space-y-3">
              {model.mitigations.map((m, i) => (
                <li key={i} className="space-y-1.5 text-sm leading-relaxed">
                  <div className="flex gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{m.recommendation}</span>
                  </div>
                  {m.service && (
                    <div className="pl-4">
                      <Badge variant="outline" className="font-mono text-[11px] text-primary">
                        {m.service}
                      </Badge>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No mitigations generated.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
