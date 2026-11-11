import type { Kind } from './catalog'

export interface NodeSpec {
  id: string
  kind: Kind
  /** What this component does in this design. */
  role: string
  col: number
  row: number
  /** Size multiplier applied to the baseline cost. */
  scale?: number
}

export interface EdgeSpec {
  from: string
  to: string
  label?: string
  dashed?: boolean
}

export interface Scenario {
  id: string
  title: string
  slug: string
  prompt: string
  keywords: string[]
  /** Who the threat model talks about. */
  actor: string
  nodes: NodeSpec[]
  edges: EdgeSpec[]
  availability: string[]
  rto: string
  rpo: string
}

export const scenarios: Scenario[] = [
  {
    id: 'saas-video',
    title: 'Multi-tenant video SaaS',
    slug: 'video-saas',
    prompt:
      'A multi-tenant SaaS that processes 10k video uploads/day with auto-scaling and SOC2 compliance.',
    keywords: ['saas', 'tenant', 'video', 'upload', 'soc2', 'transcod', 'media', 'b2b'],
    actor: 'tenant',
    nodes: [
      { id: 'client', kind: 'client', role: 'Browsers and API clients', col: 0, row: 1.3 },
      { id: 'cdn', kind: 'cdn', role: 'Edge cache, TLS', col: 1, row: 1.3 },
      { id: 'waf', kind: 'waf', role: 'Rate limits, OWASP rules', col: 2, row: 0.7 },
      { id: 'lb', kind: 'lb', role: 'Ingress across 3 zones', col: 2, row: 1.9 },
      { id: 'auth', kind: 'auth', role: 'Tenant sign-in, JWT', col: 3, row: 0.1 },
      { id: 'api', kind: 'compute', role: 'API pods, 3 to 12 replicas', col: 3, row: 1.3, scale: 1.4 },
      { id: 'queue', kind: 'queue', role: 'Transcode jobs', col: 3, row: 2.5 },
      { id: 'db', kind: 'db', role: 'Multi-AZ, row-level security', col: 4, row: 0.3, scale: 1.3 },
      { id: 'cache', kind: 'cache', role: 'Sessions, hot metadata', col: 4, row: 1.3 },
      { id: 'storage', kind: 'storage', role: 'Raw and encoded video', col: 4, row: 2.3, scale: 4 },
      { id: 'worker', kind: 'worker', role: 'Transcode workers', col: 4, row: 3.4, scale: 2.2 },
      { id: 'monitor', kind: 'monitor', role: 'Metrics, logs, alarms', col: 2, row: 3.2 },
    ],
    edges: [
      { from: 'client', to: 'cdn', label: 'HTTPS' },
      { from: 'cdn', to: 'waf' },
      { from: 'waf', to: 'lb' },
      { from: 'lb', to: 'api' },
      { from: 'api', to: 'auth', label: 'verify' },
      { from: 'api', to: 'db', label: 'SQL' },
      { from: 'api', to: 'cache' },
      { from: 'api', to: 'storage', label: 'presign' },
      { from: 'api', to: 'queue', label: 'jobs' },
      { from: 'queue', to: 'worker' },
      { from: 'worker', to: 'storage' },
      { from: 'api', to: 'monitor', dashed: true },
    ],
    availability: [
      'API pods spread across three zones with a pod disruption budget of one.',
      'Horizontal autoscaling on CPU and queue depth, 3 to 12 replicas.',
      'Database runs multi-zone with automatic failover and daily snapshots.',
      'Transcode workers scale to zero when the queue is empty.',
    ],
    rto: '30 min',
    rpo: '5 min',
  },
  {
    id: 'ecommerce',
    title: 'Low-latency e-commerce API',
    slug: 'shop-api',
    prompt: 'A low-latency e-commerce API for 1M users with a PostgreSQL database and global CDN.',
    keywords: ['commerce', 'shop', 'store', 'cart', 'checkout', 'order', 'latency', 'cdn', 'postgres', 'catalog', 'retail'],
    actor: 'shopper',
    nodes: [
      { id: 'client', kind: 'client', role: 'Web and mobile shoppers', col: 0, row: 1.2 },
      { id: 'dns', kind: 'dns', role: 'Latency-based routing', col: 1, row: 0.1 },
      { id: 'cdn', kind: 'cdn', role: 'Global edge, TLS', col: 1, row: 1.2, scale: 2.5 },
      { id: 'assets', kind: 'storage', role: 'Images, static assets', col: 1, row: 2.4 },
      { id: 'waf', kind: 'waf', role: 'Bot control, rate limits', col: 2, row: 0.6 },
      { id: 'lb', kind: 'lb', role: 'Ingress across 3 zones', col: 2, row: 1.8 },
      { id: 'api', kind: 'compute', role: 'API pods, 6 to 30 replicas', col: 3, row: 1.2, scale: 2.2 },
      { id: 'cache', kind: 'cache', role: 'Carts, catalog cache', col: 4, row: 0.1, scale: 1.8 },
      { id: 'db', kind: 'db', role: 'Primary, multi-AZ', col: 4, row: 1.0, scale: 2 },
      { id: 'replica', kind: 'db', role: 'Read replicas x2', col: 4, row: 1.9, scale: 1.6 },
      { id: 'queue', kind: 'queue', role: 'Order events', col: 3, row: 2.6 },
      { id: 'worker', kind: 'worker', role: 'Order and email workers', col: 4, row: 3.0 },
      { id: 'monitor', kind: 'monitor', role: 'Tracing, SLO alarms', col: 2, row: 3.0 },
    ],
    edges: [
      { from: 'client', to: 'dns', dashed: true, label: 'DNS' },
      { from: 'client', to: 'cdn', label: 'HTTPS' },
      { from: 'cdn', to: 'assets', label: 'origin' },
      { from: 'cdn', to: 'waf' },
      { from: 'waf', to: 'lb' },
      { from: 'lb', to: 'api' },
      { from: 'api', to: 'cache' },
      { from: 'api', to: 'db', label: 'writes' },
      { from: 'api', to: 'replica', label: 'reads' },
      { from: 'api', to: 'queue', label: 'orders' },
      { from: 'queue', to: 'worker' },
      { from: 'api', to: 'monitor', dashed: true },
    ],
    availability: [
      'Catalog reads are served from cache and two read replicas, so a primary failover does not take browsing down.',
      'API autoscaling on request rate, 6 to 30 replicas across three zones.',
      'Checkout writes go through an order queue, so a worker outage delays emails but not payments.',
      'CDN serves stale static content for up to one hour if the origin is unreachable.',
    ],
    rto: '15 min',
    rpo: '1 min',
  },
  {
    id: 'iot-pipeline',
    title: 'IoT telemetry pipeline',
    slug: 'telemetry',
    prompt: 'An event-driven data pipeline ingesting IoT telemetry with real-time dashboards.',
    keywords: ['iot', 'telemetry', 'sensor', 'event', 'pipeline', 'stream', 'dashboard', 'real-time', 'realtime', 'ingest', 'analytics', 'data'],
    actor: 'device',
    nodes: [
      { id: 'devices', kind: 'devices', role: 'Sensors over MQTT / HTTPS', col: 0, row: 1.2 },
      { id: 'stream', kind: 'stream', role: 'Ingest, 24 h retention', col: 1, row: 1.2, scale: 2 },
      { id: 'proc', kind: 'worker', role: 'Stream processors', col: 2, row: 1.2, scale: 2 },
      { id: 'dlq', kind: 'queue', role: 'Dead letters, alerts', col: 2, row: 2.5 },
      { id: 'warehouse', kind: 'warehouse', role: 'Aggregates, 13 months', col: 3, row: 0.2 },
      { id: 'lake', kind: 'storage', role: 'Raw data lake, Parquet', col: 3, row: 1.3, scale: 3 },
      { id: 'monitor', kind: 'monitor', role: 'Lag and drop alarms', col: 1, row: 2.5 },
      { id: 'api', kind: 'compute', role: 'Query API pods', col: 4, row: 0.2, scale: 0.8 },
      { id: 'cache', kind: 'cache', role: 'Live tiles, 5 s TTL', col: 3, row: 2.4 },
      { id: 'cdn', kind: 'cdn', role: 'Dashboards for operators', col: 4, row: 1.3 },
    ],
    edges: [
      { from: 'devices', to: 'stream', label: 'events' },
      { from: 'stream', to: 'proc' },
      { from: 'proc', to: 'warehouse', label: 'rollups' },
      { from: 'proc', to: 'lake', label: 'raw' },
      { from: 'proc', to: 'dlq', label: 'failed' },
      { from: 'proc', to: 'monitor', dashed: true },
      { from: 'warehouse', to: 'api' },
      { from: 'proc', to: 'cache', label: 'live' },
      { from: 'api', to: 'cache' },
      { from: 'api', to: 'cdn' },
    ],
    availability: [
      'The stream keeps 24 hours of events, so processors can be redeployed or fail without data loss.',
      'Stream processors checkpoint offsets and scale on consumer lag.',
      'Failed events land in a dead-letter queue with an alarm instead of blocking the partition.',
      'The raw data lake is the source of truth; the warehouse can be rebuilt from it.',
    ],
    rto: '1 h',
    rpo: '0 (replay from stream)',
  },
]
