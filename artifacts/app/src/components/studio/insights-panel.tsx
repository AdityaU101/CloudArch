import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, TrendingUp } from "lucide-react";
import type { Insights, Severity } from "@/lib/architecture-insights";
import { AnimatedNumber } from "./animated-number";

const SEVERITY: Record<Severity, { icon: typeof Info; hue: string; label: string }> = {
  risk: { icon: AlertTriangle, hue: "0 78% 62%", label: "Risk" },
  warn: { icon: Info, hue: "38 92% 55%", label: "Warning" },
  tip: { icon: Lightbulb, hue: "200 90% 55%", label: "Suggestion" },
  good: { icon: CheckCircle2, hue: "150 70% 45%", label: "Strength" },
};

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const hue = value >= 70 ? "150 70% 45%" : value >= 45 ? "38 92% 55%" : "0 78% 62%";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: `hsl(${hue})` }}>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `hsl(${hue})` }}
          initial={false}
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
        />
      </div>
    </div>
  );
}

/**
 * The right rail. Shows the live monthly cost, a resilience scorecard, the cost
 * split by category, and a feed of tradeoffs that animates as the design changes.
 */
export function InsightsPanel({ insights }: { insights: Insights }) {
  const { monthly, count, scores, tradeoffs, costByCategory } = insights;
  const maxCat = Math.max(1, ...costByCategory.map((c) => c.amount));

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card/40">
      <div className="space-y-4 overflow-y-auto p-4">
        {/* Live cost */}
        <div className="rounded-xl border border-border bg-gradient-to-b from-primary/[0.08] to-transparent p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Estimated monthly cost
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber value={monthly} prefix="$" className="text-3xl font-semibold tabular-nums text-foreground" />
            <span className="text-sm text-muted-foreground">/mo</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {count} component{count === 1 ? "" : "s"} · illustrative on-demand pricing
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-2.5 rounded-xl border border-border p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resilience</div>
          <ScoreMeter label="Availability" value={scores.availability} />
          <ScoreMeter label="Scalability" value={scores.scalability} />
          <ScoreMeter label="Security" value={scores.security} />
        </div>

        {/* Cost breakdown */}
        {costByCategory.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cost by category</div>
            {costByCategory.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="tabular-nums text-foreground">${c.amount}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `hsl(${c.hue})` }}
                    initial={false}
                    animate={{ width: `${(c.amount / maxCat) * 100}%` }}
                    transition={{ type: "spring", stiffness: 160, damping: 22 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tradeoffs feed */}
        <div>
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tradeoffs & recommendations
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {tradeoffs.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground"
                >
                  Add components to see live tradeoffs.
                </motion.p>
              ) : (
                tradeoffs.map((t) => {
                  const s = SEVERITY[t.severity];
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      className="rounded-lg border border-border bg-card/60 p-2.5"
                      style={{ borderLeftColor: `hsl(${s.hue})`, borderLeftWidth: 2 }}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${s.hue})` }} />
                        <div>
                          <div className="text-[12px] font-medium leading-snug text-foreground">{t.title}</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.detail}</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
