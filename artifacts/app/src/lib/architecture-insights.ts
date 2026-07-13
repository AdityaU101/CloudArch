import { specFor, type CapabilityTag, type ResolvedSpec } from "./cloud-catalog";
import type { CloudProvider } from "./cloud-providers";

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
function resolveSpecs(types: string[], provider: CloudProvider): ResolvedSpec[] {
  return types.map((t) => specFor(t, provider)).filter((s): s is ResolvedSpec => Boolean(s));
}

function has(specs: ResolvedSpec[], tag: CapabilityTag): boolean {
  return specs.some((s) => s.tags.includes(tag));
}

function count(specs: ResolvedSpec[], tag: CapabilityTag): number {
  return specs.filter((s) => s.tags.includes(tag)).length;
}

/** Provider-specific service names used in tradeoff copy. */
interface ProviderVoice {
  vendor: string;
  entry: string;
  haDb: string;
  backup: string;
  cache: string;
  cdnDetail: string;
  waf: string;
  monitor: string;
  zones: string;
}

const VOICES: Record<CloudProvider, ProviderVoice> = {
  aws: {
    vendor: "AWS",
    entry: "an Application Load Balancer or API Gateway",
    haDb: "Aurora or a Multi-AZ RDS deployment",
    backup: "AWS Backup",
    cache: "ElastiCache",
    cdnDetail: "CloudFront caches S3 content at the edge",
    waf: "AWS WAF",
    monitor: "CloudWatch",
    zones: "Availability Zones",
  },
  azure: {
    vendor: "Azure",
    entry: "an Application Gateway or API Management front end",
    haDb: "Azure SQL Business Critical or zone-redundant PostgreSQL",
    backup: "Azure Backup",
    cache: "Azure Cache for Redis",
    cdnDetail: "Azure Front Door caches Blob Storage content at the edge",
    waf: "Azure WAF",
    monitor: "Azure Monitor",
    zones: "Availability Zones",
  },
  gcp: {
    vendor: "Google Cloud",
    entry: "Cloud Load Balancing or API Gateway",
    haDb: "AlloyDB or a regional (HA) Cloud SQL instance",
    backup: "Backup and DR",
    cache: "Memorystore",
    cdnDetail: "Cloud CDN caches Cloud Storage content at the edge",
    waf: "Cloud Armor",
    monitor: "Cloud Monitoring",
    zones: "zones",
  },
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Derive cost, resilience scores, and human-readable tradeoffs from the set of
 * components on the canvas. Pure and cheap — safe to run on every edit.
 */
export function computeInsights(types: string[], provider: CloudProvider = "aws"): Insights {
  const specs = resolveSpecs(types, provider);
  const voice = VOICES[provider];
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
      detail: `Traffic hits a single instance directly. Add ${voice.entry} to remove the single point of failure.`,
    });
  }
  if (hasStateful && !has(specs, "managed-ha") && !has(specs, "backup")) {
    add({
      id: "db-spof",
      severity: "risk",
      title: "Database has no redundancy or backups",
      detail: `A single database is a data-loss risk. Switch to ${voice.haDb}, or add ${voice.backup} for recovery.`,
    });
  }
  if (hasStateful && !has(specs, "cache")) {
    add({
      id: "no-cache",
      severity: "tip",
      title: "Add a cache to relieve the database",
      detail: `${voice.cache} in front of your database cuts read latency and lets you scale reads cheaply.`,
    });
  }
  if (has(specs, "object-store") && !has(specs, "cdn")) {
    add({
      id: "no-cdn",
      severity: "tip",
      title: "Serve static assets through a CDN",
      detail: `${voice.cdnDetail}, lowering latency and egress cost.`,
    });
  }
  if (hasEntry && !has(specs, "waf")) {
    add({
      id: "no-waf",
      severity: "warn",
      title: "Public entry point is unprotected",
      detail: `Add ${voice.waf} to filter common web exploits before they reach your application.`,
    });
  }
  if (specs.length > 0 && !has(specs, "observability")) {
    add({
      id: "no-observability",
      severity: "warn",
      title: "No monitoring configured",
      detail: `Add ${voice.monitor} so you can see metrics, logs, and get alerted before users do.`,
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
      title: "Managed highly-available services in play",
      detail: `${voice.vendor} handles failover across ${voice.zones} for these components.`,
    });
  }

  // Order: risks first, then warnings, tips, wins.
  const rank: Record<Severity, number> = { risk: 0, warn: 1, tip: 2, good: 3 };
  t.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return { monthly, count: specs.length, scores, tradeoffs: t, costByCategory };
}

function catMeta(s: ResolvedSpec): { label: string; hue: string } {
  // Local import avoidance: map category id → label/hue via the catalog module.
  const meta = CATEGORY_META[s.category];
  return meta;
}

// Mirror of CATEGORIES to avoid a circular import surface; kept in sync with cloud-catalog.
const CATEGORY_META: Record<string, { label: string; hue: string }> = {
  compute: { label: "Compute", hue: "36 100% 50%" },
  database: { label: "Database", hue: "200 90% 48%" },
  storage: { label: "Storage", hue: "150 70% 45%" },
  network: { label: "Networking", hue: "268 78% 62%" },
  security: { label: "Security", hue: "340 78% 62%" },
  integration: { label: "Integration", hue: "190 12% 60%" },
};
