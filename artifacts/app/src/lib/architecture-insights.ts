import { specFor, type CapabilityTag, type ComponentSpec } from "./aws-catalog";

export type Severity = "good" | "warn" | "risk" | "tip";

export interface Tradeoff {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface ScoreBreakdown {
  availability: number; // 0-100
  scalability: number;
  security: number;
}

export interface Insights {
  monthly: number;
  count: number;
  scores: ScoreBreakdown;
  tradeoffs: Tradeoff[];
  /** Cost split by category label, for the breakdown bar. */
  costByCategory: { label: string; hue: string; amount: number }[];
}

/** The set of components currently on the canvas, resolved to their specs. */
function resolveSpecs(types: string[]): ComponentSpec[] {
  return types.map(specFor).filter((s): s is ComponentSpec => Boolean(s));
}

function has(specs: ComponentSpec[], tag: CapabilityTag): boolean {
  return specs.some((s) => s.tags.includes(tag));
}

function count(specs: ComponentSpec[], tag: CapabilityTag): number {
  return specs.filter((s) => s.tags.includes(tag)).length;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Derive cost, resilience scores, and human-readable tradeoffs from the set of
 * components on the canvas. Pure and cheap — safe to run on every edit.
 */
export function computeInsights(types: string[]): Insights {
  const specs = resolveSpecs(types);
  const monthly = specs.reduce((sum, s) => sum + s.monthly, 0);

  // --- cost by category ---
  const byCat = new Map<string, { label: string; hue: string; amount: number }>();
  for (const s of specs) {
    const cat = catMeta(s);
    const existing = byCat.get(cat.label);
    if (existing) existing.amount += s.monthly;
    else if (s.monthly > 0) byCat.set(cat.label, { ...cat, amount: s.monthly });
  }
  const costByCategory = [...byCat.values()].sort((a, b) => b.amount - a.amount);

  // --- scoring heuristics ---
  const computeNodes = count(specs, "compute");
  const hasEntry = has(specs, "entrypoint");
  const hasStateful = has(specs, "stateful");
  const scores: ScoreBreakdown = {
    availability: clamp(
      40 +
        (hasEntry ? 20 : 0) +
        (has(specs, "managed-ha") ? 18 : 0) +
        (has(specs, "backup") ? 12 : 0) +
        (has(specs, "autoscale") ? 10 : 0) -
        (hasStateful && !has(specs, "managed-ha") && !has(specs, "backup") ? 15 : 0),
    ),
    scalability: clamp(
      35 +
        (has(specs, "autoscale") ? 22 : 0) +
        (has(specs, "serverless") ? 18 : 0) +
        (has(specs, "cache") ? 12 : 0) +
        (has(specs, "cdn") ? 13 : 0) +
        (has(specs, "queue") ? 8 : 0),
    ),
    security: clamp(
      30 +
        (has(specs, "waf") ? 18 : 0) +
        (has(specs, "encryption") ? 14 : 0) +
        (has(specs, "secrets") ? 12 : 0) +
        (has(specs, "identity") ? 12 : 0) +
        (has(specs, "private-network") ? 14 : 0),
    ),
  };

  // --- tradeoffs ---
  const t: Tradeoff[] = [];
  const add = (o: Tradeoff) => t.push(o);

  if (computeNodes > 0 && !hasEntry) {
    add({
      id: "no-entrypoint",
      severity: "risk",
      title: "No load balancer in front of compute",
      detail: "Traffic hits a single instance directly. Add an Application Load Balancer or API Gateway to remove the single point of failure.",
    });
  }
  if (hasStateful && !has(specs, "managed-ha") && !has(specs, "backup")) {
    add({
      id: "db-spof",
      severity: "risk",
      title: "Database has no redundancy or backups",
      detail: "A single database is a data-loss risk. Switch to Aurora / Multi-AZ, or add AWS Backup for recovery.",
    });
  }
  if (hasStateful && !has(specs, "cache")) {
    add({
      id: "no-cache",
      severity: "tip",
      title: "Add a cache to relieve the database",
      detail: "ElastiCache in front of your database cuts read latency and lets you scale reads cheaply.",
    });
  }
  if (has(specs, "object-store") && !has(specs, "cdn")) {
    add({
      id: "no-cdn",
      severity: "tip",
      title: "Serve static assets through a CDN",
      detail: "CloudFront caches S3 content at the edge, lowering latency and egress cost.",
    });
  }
  if (hasEntry && !has(specs, "waf")) {
    add({
      id: "no-waf",
      severity: "warn",
      title: "Public entry point is unprotected",
      detail: "Add WAF to filter common web exploits before they reach your application.",
    });
  }
  if (specs.length > 0 && !has(specs, "observability")) {
    add({
      id: "no-observability",
      severity: "warn",
      title: "No monitoring configured",
      detail: "Add CloudWatch so you can see metrics, logs, and get alerted before users do.",
    });
  }
  if (has(specs, "serverless")) {
    add({
      id: "serverless-good",
      severity: "good",
      title: "Serverless components scale to zero",
      detail: "You only pay when they run, which keeps idle cost low and absorbs traffic spikes automatically.",
    });
  }
  if (has(specs, "managed-ha")) {
    add({
      id: "managed-good",
      severity: "good",
      title: "Managed multi-AZ services in play",
      detail: "AWS handles failover across availability zones for these components.",
    });
  }

  // Order: risks first, then warnings, tips, wins.
  const rank: Record<Severity, number> = { risk: 0, warn: 1, tip: 2, good: 3 };
  t.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return { monthly, count: specs.length, scores, tradeoffs: t, costByCategory };
}

function catMeta(s: ComponentSpec): { label: string; hue: string } {
  // Local import avoidance: map category id → label/hue via the catalog module.
  const meta = CATEGORY_META[s.category];
  return meta;
}

// Mirror of CATEGORIES to avoid a circular import surface; kept in sync with aws-catalog.
const CATEGORY_META: Record<string, { label: string; hue: string }> = {
  compute: { label: "Compute", hue: "36 100% 50%" },
  database: { label: "Database", hue: "200 90% 48%" },
  storage: { label: "Storage", hue: "150 70% 45%" },
  network: { label: "Networking", hue: "268 78% 62%" },
  security: { label: "Security", hue: "340 78% 62%" },
  integration: { label: "Integration", hue: "190 12% 60%" },
};
