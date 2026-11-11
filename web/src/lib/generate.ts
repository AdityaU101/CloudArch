import { baseCost, kindGroup, serviceName, support, type Kind, type Provider } from '../data/catalog'
import { scenarios, type EdgeSpec, type NodeSpec, type Scenario } from '../data/scenarios'
import { buildKubernetes, buildPipeline, buildTerraform } from './terraform'

export interface ArchNode extends NodeSpec {
  service: string
  cost: number
  group: string
}

export type Level = 'Low' | 'Medium' | 'High'

export interface Threat {
  letter: 'S' | 'T' | 'R' | 'I' | 'D' | 'E'
  category: string
  target: string
  threat: string
  mitigation: string
  likelihood: Level
  impact: Level
}

export interface Architecture {
  scenario: Scenario
  provider: Provider
  nodes: ArchNode[]
  edges: EdgeSpec[]
  total: number
  terraform: string
  kubernetes: string
  pipeline: string
  security: { title: string; detail: string }[]
  threats: Threat[]
}

/** Pick the prepared scenario whose keywords best match the brief. */
export function matchScenario(brief: string): { scenario: Scenario; exact: boolean } {
  const text = brief.toLowerCase()
  const exact = scenarios.find((s) => s.prompt.toLowerCase() === text.trim())
  if (exact) return { scenario: exact, exact: true }
  let best = scenarios[0]
  let bestScore = 0
  for (const s of scenarios) {
    const score = s.keywords.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0)
    if (score > bestScore) {
      best = s
      bestScore = score
    }
  }
  return { scenario: best, exact: false }
}

const external = (k: Kind) => k === 'client' || k === 'devices'

function find(s: Scenario, p: Provider, ...kinds: Kind[]) {
  const n = s.nodes.find((x) => kinds.includes(x.kind))
  return n ? serviceName[n.kind][p] : serviceName[kinds[0]][p]
}

function threats(s: Scenario, p: Provider): Threat[] {
  const sv = (k: keyof typeof support) => support[k][p]
  const edge = find(s, p, 'waf', 'cdn', 'stream')
  const data = find(s, p, 'db', 'warehouse')
  const store = find(s, p, 'storage')
  const compute = find(s, p, 'compute', 'worker')
  const who = s.actor
  return [
    {
      letter: 'S', category: 'Spoofing', target: s.nodes.some((n) => n.kind === 'auth') ? find(s, p, 'auth') : edge,
      threat:
        who === 'device'
          ? 'A cloned or stolen device certificate is used to inject telemetry as a legitimate sensor.'
          : `Stolen or forged session tokens are used to call the API as another ${who}.`,
      mitigation:
        who === 'device'
          ? `Per-device X.509 identities with rotation, and a revocation list checked at ingest.`
          : `Short-lived signed tokens, refresh rotation, and mutual TLS between services.`,
      likelihood: 'Medium', impact: 'High',
    },
    {
      letter: 'T', category: 'Tampering', target: store,
      threat: 'Stored objects or in-flight messages are altered between the producer and the consumer.',
      mitigation: `Envelope encryption with ${sv('kms')}, object versioning on ${store}, and checksums verified by consumers.`,
      likelihood: 'Low', impact: 'High',
    },
    {
      letter: 'R', category: 'Repudiation', target: compute,
      threat: 'A privileged change is made with no record that ties it to a person or workload.',
      mitigation: `${sv('audit')} enabled in every region, shipped to a write-once bucket with a one-year retention lock.`,
      likelihood: 'Medium', impact: 'Medium',
    },
    {
      letter: 'I', category: 'Information disclosure', target: data,
      threat:
        who === 'tenant'
          ? 'A query without a tenant filter returns rows that belong to another tenant.'
          : `Data in ${data} is reachable from outside the private network or through over-broad credentials.`,
      mitigation:
        who === 'tenant'
          ? `Row-level security enforced in ${data}, private subnets only, credentials issued from ${sv('secrets')}.`
          : `Private endpoints only, column-level grants, and credentials issued from ${sv('secrets')}.`,
      likelihood: 'Medium', impact: 'High',
    },
    {
      letter: 'D', category: 'Denial of service', target: edge,
      threat:
        who === 'device'
          ? 'A misconfigured fleet floods the ingest stream and starves downstream processors.'
          : 'A volumetric or application-layer flood exhausts API capacity.',
      mitigation: `Rate limits at ${edge}, ${sv('ddos')}, and autoscaling with a hard ceiling to cap spend.`,
      likelihood: 'High', impact: 'Medium',
    },
    {
      letter: 'E', category: 'Elevation of privilege', target: compute,
      threat: 'A compromised container uses node-level credentials to reach services it should not.',
      mitigation: `${sv('workloadId')} for per-workload roles, least-privilege ${sv('iam')} policies, and default-deny network policies.`,
      likelihood: 'Low', impact: 'High',
    },
  ]
}

function security(s: Scenario, p: Provider) {
  const sv = (k: keyof typeof support) => support[k][p]
  return [
    { title: 'Identity', detail: `No long-lived keys. Workloads authenticate through ${sv('workloadId')}; people through ${sv('iam')} with MFA.` },
    { title: 'Network', detail: `Everything except the edge sits in private subnets of the ${sv('network')}. Data stores accept traffic from the compute tier only.` },
    { title: 'Encryption', detail: `TLS 1.2+ in transit. At rest, every data store uses customer-managed keys in ${sv('kms')} with yearly rotation.` },
    { title: 'Secrets', detail: `Database and third-party credentials live in ${sv('secrets')} and are mounted at runtime, never baked into images.` },
    { title: 'Supply chain', detail: `Images are built in CI, scanned, signed and pulled only from ${sv('registry')}.` },
    { title: 'Audit', detail: `${sv('audit')} and ${find(s, p, 'monitor')} logs are retained for one year in a locked bucket.` },
  ]
}

export function build(scenario: Scenario, provider: Provider): Architecture {
  const nodes: ArchNode[] = scenario.nodes.map((n) => ({
    ...n,
    service: serviceName[n.kind][provider],
    group: kindGroup[n.kind],
    cost: external(n.kind) ? 0 : Math.round(baseCost[n.kind][provider] * (n.scale ?? 1)),
  }))
  return {
    scenario,
    provider,
    nodes,
    edges: scenario.edges,
    total: nodes.reduce((sum, n) => sum + n.cost, 0),
    terraform: buildTerraform(scenario, provider),
    kubernetes: buildKubernetes(scenario, provider),
    pipeline: buildPipeline(scenario, provider),
    security: security(scenario, provider),
    threats: threats(scenario, provider),
  }
}

export const STAGES = [
  'Parsing requirements',
  'Selecting services',
  'Routing the topology',
  'Writing Terraform and manifests',
  'Estimating monthly cost',
  'Running STRIDE analysis',
] as const
