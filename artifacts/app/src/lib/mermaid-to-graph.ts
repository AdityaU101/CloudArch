import { CATALOG } from "./aws-catalog";

export interface SeedNode {
  id: string;
  type: string; // catalog type
  label: string;
  position: { x: number; y: number };
}
export interface SeedEdge {
  id: string;
  source: string;
  target: string;
}
export interface SeedGraph {
  nodes: SeedNode[];
  edges: SeedEdge[];
}

/** Keyword table to map a diagram label onto a catalog component type. */
const KEYWORDS: [RegExp, string][] = [
  [/cloud ?front|\bcdn\b|edge/i, "cloudfront"],
  [/route ?53|\bdns\b/i, "route53"],
  [/api ?gateway|\bapi gw\b/i, "apigw"],
  [/load ?balancer|\balb\b|\belb\b|\bnlb\b/i, "alb"],
  [/\bwaf\b|firewall/i, "waf"],
  [/lambda|function/i, "lambda"],
  [/\beks\b|kubernetes|k8s/i, "eks"],
  [/\becs\b|fargate|container/i, "ecs"],
  [/auto ?scal/i, "asg"],
  [/aurora/i, "aurora"],
  [/dynamo/i, "dynamodb"],
  [/elasticache|redis|memcached|\bcache\b/i, "elasticache"],
  [/\brds\b|postgres|mysql|relational|database|\bdb\b/i, "rds"],
  [/\bs3\b|bucket|object stor/i, "s3"],
  [/\bebs\b|block stor|volume/i, "ebs"],
  [/backup/i, "backup"],
  [/cognito|auth|identity/i, "cognito"],
  [/secrets? ?manager/i, "secrets"],
  [/\bkms\b|encrypt/i, "kms"],
  [/\bsqs\b|queue/i, "sqs"],
  [/cloud ?watch|monitor|logging|metric/i, "cloudwatch"],
  [/\bvpc\b|subnet|network/i, "vpc"],
  [/\bec2\b|instance|server|compute|web ?server|app ?server/i, "ec2"],
];

function guessType(label: string): string | null {
  for (const [re, type] of KEYWORDS) if (re.test(label)) return type;
  return null;
}

const NODE_DEF =
  /(\b[A-Za-z0-9_]+\b)\s*(?:\[\[?"?([^\]"]+)"?\]?\]|\("?([^)"]+)"?\)|\{"?([^}"]+)"?\}|\(\(([^)]+)\)\))/g;
const EDGE =
  /(\b[A-Za-z0-9_]+\b)\s*(?:-->|---|-\.->|==>)\s*(?:\|[^|]*\|\s*)?(\b[A-Za-z0-9_]+\b)/g;

/**
 * Best-effort conversion of an AI-generated Mermaid flowchart into an editable
 * graph. Unknown node shapes are ignored; labels that don't map to a known
 * component fall back to a generic EC2 box so nothing is silently dropped.
 */
export function mermaidToGraph(chart: string): SeedGraph {
  if (!chart) return { nodes: [], edges: [] };
  const clean = chart.replace(/^```mermaid\s*/i, "").replace(/```\s*$/, "");

  const labels = new Map<string, string>();
  let m: RegExpExecArray | null;
  NODE_DEF.lastIndex = 0;
  while ((m = NODE_DEF.exec(clean))) {
    const id = m[1];
    const label = (m[2] || m[3] || m[4] || m[5] || id).trim();
    if (id && !labels.has(id)) labels.set(id, label);
  }

  const rawEdges: { source: string; target: string }[] = [];
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  EDGE.lastIndex = 0;
  while ((m = EDGE.exec(clean))) {
    const [, source, target] = m;
    if (source === target) continue;
    rawEdges.push({ source, target });
    if (!labels.has(source)) labels.set(source, source);
    if (!labels.has(target)) labels.set(target, target);
    adj.set(source, [...(adj.get(source) ?? []), target]);
    indeg.set(target, (indeg.get(target) ?? 0) + 1);
    if (!indeg.has(source)) indeg.set(source, indeg.get(source) ?? 0);
  }

  const ids = [...labels.keys()];
  if (ids.length === 0) return { nodes: [], edges: [] };

  // Layered layout: BFS depth from roots (no incoming edges) → columns.
  const depth = new Map<string, number>();
  const roots = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  const queue = roots.length ? [...roots] : [ids[0]];
  queue.forEach((id) => depth.set(id, 0));
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    for (const next of adj.get(id) ?? []) {
      if (!depth.has(next) || (depth.get(next) ?? 0) < d + 1) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }
  ids.forEach((id) => { if (!depth.has(id)) depth.set(id, 0); });

  const COL_W = 260;
  const ROW_H = 132;
  const perColumn = new Map<number, number>();
  const nodes: SeedNode[] = ids.map((id) => {
    const d = depth.get(id) ?? 0;
    const row = perColumn.get(d) ?? 0;
    perColumn.set(d, row + 1);
    const label = labels.get(id) ?? id;
    const type = guessType(label) ?? "ec2";
    return {
      id,
      type,
      label: CATALOG.find((c) => c.type === type)?.label ?? label,
      position: { x: d * COL_W + 40, y: row * ROW_H + 40 },
    };
  });

  const seen = new Set<string>();
  const edges: SeedEdge[] = [];
  rawEdges.forEach(({ source, target }, i) => {
    const key = `${source}->${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: `e${i}-${source}-${target}`, source, target });
  });

  return { nodes, edges };
}
