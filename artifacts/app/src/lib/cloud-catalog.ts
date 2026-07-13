import {
  Server,
  Cpu,
  Boxes,
  Container,
  Zap,
  HardDrive,
  Database,
  Archive,
  Network,
  Globe,
  Route,
  DoorOpen,
  Shield,
  KeyRound,
  Lock,
  UserCheck,
  Waypoints,
  Radio,
  Activity,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { CloudProvider } from "./cloud-providers";

/**
 * A cloud component category. Each maps to one of the design system's chart
 * accent tokens so nodes stay visually consistent with the rest of the app.
 */
export type CategoryId =
  | "compute"
  | "network"
  | "database"
  | "storage"
  | "security"
  | "integration";

export interface Category {
  id: CategoryId;
  label: string;
  /** hsl() triple pulled from the --chart-* design tokens. */
  hue: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  compute: { id: "compute", label: "Compute", hue: "36 100% 50%" },
  database: { id: "database", label: "Database", hue: "200 90% 48%" },
  storage: { id: "storage", label: "Storage", hue: "150 70% 45%" },
  network: { id: "network", label: "Networking", hue: "268 78% 62%" },
  security: { id: "security", label: "Security", hue: "340 78% 62%" },
  integration: { id: "integration", label: "Integration", hue: "190 12% 60%" },
};

/** The provider-specific face of a component: what it's called and roughly costs there. */
export interface ProviderService {
  label: string;
  /** Representative on-demand cost per month, in USD. Illustrative, not a quote. */
  monthly: number;
}

/**
 * A provider-agnostic building block. The `type` key is the stable identity a
 * node carries on the canvas; `services` maps it onto the equivalent offering
 * (name + illustrative price) in each cloud.
 */
export interface ComponentSpec {
  /** Stable catalog key, e.g. "ec2". Provider-neutral. */
  type: string;
  category: CategoryId;
  icon: LucideIcon;
  /** One-line "what it's for", written for the person, not the system. */
  blurb: string;
  /** Capability tags the insights engine reasons over. */
  tags: CapabilityTag[];
  services: Record<CloudProvider, ProviderService>;
}

/** A ComponentSpec flattened onto one provider — what the UI actually renders. */
export interface ResolvedSpec {
  type: string;
  category: CategoryId;
  icon: LucideIcon;
  blurb: string;
  tags: CapabilityTag[];
  label: string;
  monthly: number;
}

/** Capabilities used by the tradeoff/scoring engine (see architecture-insights). */
export type CapabilityTag =
  | "entrypoint" // faces the public internet / load balances
  | "cdn"
  | "compute"
  | "serverless"
  | "autoscale"
  | "stateful" // holds primary data
  | "managed-ha" // managed service with built-in multi-AZ
  | "cache"
  | "queue"
  | "object-store"
  | "backup"
  | "waf"
  | "secrets"
  | "encryption"
  | "identity"
  | "observability"
  | "private-network";

const svc = (aws: ProviderService, azure: ProviderService, gcp: ProviderService) => ({ aws, azure, gcp });

export const CATALOG: ComponentSpec[] = [
  // Compute
  {
    type: "ec2", category: "compute", icon: Server,
    blurb: "A virtual server you manage yourself.", tags: ["compute"],
    services: svc(
      { label: "EC2 Instance", monthly: 62 },
      { label: "Azure Virtual Machine", monthly: 60 },
      { label: "Compute Engine VM", monthly: 57 },
    ),
  },
  {
    type: "asg", category: "compute", icon: Cpu,
    blurb: "Adds and removes servers as traffic changes.", tags: ["autoscale"],
    services: svc(
      { label: "Auto Scaling Group", monthly: 0 },
      { label: "VM Scale Set", monthly: 0 },
      { label: "Managed Instance Group", monthly: 0 },
    ),
  },
  {
    type: "ecs", category: "compute", icon: Container,
    blurb: "Runs containers without managing servers.", tags: ["compute", "autoscale"],
    services: svc(
      { label: "ECS / Fargate", monthly: 48 },
      { label: "Azure Container Apps", monthly: 45 },
      { label: "Cloud Run", monthly: 40 },
    ),
  },
  {
    type: "eks", category: "compute", icon: Boxes,
    blurb: "Managed Kubernetes for container workloads.", tags: ["compute", "autoscale", "managed-ha"],
    services: svc(
      { label: "EKS Cluster", monthly: 146 },
      { label: "AKS Cluster", monthly: 110 },
      { label: "GKE Cluster", monthly: 105 },
    ),
  },
  {
    type: "lambda", category: "compute", icon: Zap,
    blurb: "Runs code on demand and scales to zero.", tags: ["compute", "serverless", "autoscale"],
    services: svc(
      { label: "Lambda Function", monthly: 8 },
      { label: "Azure Function", monthly: 8 },
      { label: "Cloud Function", monthly: 8 },
    ),
  },

  // Networking
  {
    type: "alb", category: "network", icon: Waypoints,
    blurb: "Spreads traffic across healthy instances.", tags: ["entrypoint", "managed-ha"],
    services: svc(
      { label: "Application Load Balancer", monthly: 22 },
      { label: "Application Gateway", monthly: 36 },
      { label: "Cloud Load Balancing", monthly: 18 },
    ),
  },
  {
    type: "apigw", category: "network", icon: DoorOpen,
    blurb: "Managed front door for your APIs.", tags: ["entrypoint", "serverless", "managed-ha"],
    services: svc(
      { label: "API Gateway", monthly: 14 },
      { label: "API Management", monthly: 18 },
      { label: "API Gateway", monthly: 14 },
    ),
  },
  {
    type: "cloudfront", category: "network", icon: Globe,
    blurb: "Serves content from edge locations worldwide.", tags: ["cdn", "entrypoint", "managed-ha"],
    services: svc(
      { label: "CloudFront CDN", monthly: 30 },
      { label: "Azure Front Door", monthly: 35 },
      { label: "Cloud CDN", monthly: 28 },
    ),
  },
  {
    type: "route53", category: "network", icon: Route,
    blurb: "DNS and health-checked routing.", tags: ["managed-ha"],
    services: svc(
      { label: "Route 53", monthly: 2 },
      { label: "Azure DNS", monthly: 1 },
      { label: "Cloud DNS", monthly: 1 },
    ),
  },
  {
    type: "vpc", category: "network", icon: Network,
    blurb: "Your private, isolated network.", tags: ["private-network"],
    services: svc(
      { label: "VPC / Subnets", monthly: 0 },
      { label: "Virtual Network", monthly: 0 },
      { label: "VPC Network", monthly: 0 },
    ),
  },

  // Database
  {
    type: "rds", category: "database", icon: Database,
    blurb: "Managed relational database.", tags: ["stateful"],
    services: svc(
      { label: "RDS (PostgreSQL)", monthly: 128 },
      { label: "Azure Database for PostgreSQL", monthly: 125 },
      { label: "Cloud SQL (PostgreSQL)", monthly: 118 },
    ),
  },
  {
    type: "aurora", category: "database", icon: Database,
    blurb: "High-throughput, replicated relational DB.", tags: ["stateful", "managed-ha"],
    services: svc(
      { label: "Aurora Cluster", monthly: 210 },
      { label: "Azure SQL (Business Critical)", monthly: 230 },
      { label: "AlloyDB Cluster", monthly: 206 },
    ),
  },
  {
    type: "dynamodb", category: "database", icon: Layers,
    blurb: "Serverless key-value store that scales flat.", tags: ["stateful", "serverless", "managed-ha", "autoscale"],
    services: svc(
      { label: "DynamoDB", monthly: 26 },
      { label: "Cosmos DB", monthly: 32 },
      { label: "Firestore", monthly: 24 },
    ),
  },
  {
    type: "elasticache", category: "database", icon: Zap,
    blurb: "In-memory cache in front of your database.", tags: ["cache"],
    services: svc(
      { label: "ElastiCache (Redis)", monthly: 54 },
      { label: "Azure Cache for Redis", monthly: 50 },
      { label: "Memorystore (Redis)", monthly: 47 },
    ),
  },

  // Storage
  {
    type: "s3", category: "storage", icon: Archive,
    blurb: "Durable object storage for files and backups.", tags: ["object-store", "managed-ha"],
    services: svc(
      { label: "S3 Bucket", monthly: 18 },
      { label: "Blob Storage", monthly: 16 },
      { label: "Cloud Storage Bucket", monthly: 15 },
    ),
  },
  {
    type: "ebs", category: "storage", icon: HardDrive,
    blurb: "Block storage attached to an instance.", tags: [],
    services: svc(
      { label: "EBS Volume", monthly: 12 },
      { label: "Managed Disk", monthly: 11 },
      { label: "Persistent Disk", monthly: 10 },
    ),
  },
  {
    type: "backup", category: "storage", icon: Archive,
    blurb: "Scheduled, retained backups for recovery.", tags: ["backup"],
    services: svc(
      { label: "AWS Backup", monthly: 9 },
      { label: "Azure Backup", monthly: 9 },
      { label: "Backup and DR", monthly: 8 },
    ),
  },

  // Security
  {
    type: "waf", category: "security", icon: Shield,
    blurb: "Filters malicious web traffic.", tags: ["waf"],
    services: svc(
      { label: "WAF", monthly: 16 },
      { label: "Azure WAF", monthly: 18 },
      { label: "Cloud Armor", monthly: 17 },
    ),
  },
  {
    type: "cognito", category: "security", icon: UserCheck,
    blurb: "User sign-up, sign-in, and tokens.", tags: ["identity"],
    services: svc(
      { label: "Cognito", monthly: 0 },
      { label: "Entra External ID", monthly: 0 },
      { label: "Identity Platform", monthly: 0 },
    ),
  },
  {
    type: "secrets", category: "security", icon: KeyRound,
    blurb: "Stores and rotates credentials safely.", tags: ["secrets"],
    services: svc(
      { label: "Secrets Manager", monthly: 4 },
      { label: "Key Vault (Secrets)", monthly: 3 },
      { label: "Secret Manager", monthly: 3 },
    ),
  },
  {
    type: "kms", category: "security", icon: Lock,
    blurb: "Manages encryption keys for data at rest.", tags: ["encryption"],
    services: svc(
      { label: "KMS Encryption", monthly: 3 },
      { label: "Key Vault (Keys)", monthly: 3 },
      { label: "Cloud KMS", monthly: 3 },
    ),
  },

  // Integration
  {
    type: "sqs", category: "integration", icon: Radio,
    blurb: "Buffers work between services.", tags: ["queue", "serverless"],
    services: svc(
      { label: "SQS Queue", monthly: 5 },
      { label: "Service Bus Queue", monthly: 10 },
      { label: "Pub/Sub", monthly: 6 },
    ),
  },
  {
    type: "cloudwatch", category: "integration", icon: Activity,
    blurb: "Metrics, logs, and alarms.", tags: ["observability"],
    services: svc(
      { label: "CloudWatch", monthly: 11 },
      { label: "Azure Monitor", monthly: 12 },
      { label: "Cloud Monitoring", monthly: 10 },
    ),
  },
];

export const CATALOG_BY_TYPE: Record<string, ComponentSpec> = Object.fromEntries(
  CATALOG.map((c) => [c.type, c]),
);

function resolve(spec: ComponentSpec, provider: CloudProvider): ResolvedSpec {
  const { services, ...rest } = spec;
  const service = services[provider] ?? services.aws;
  return { ...rest, ...service };
}

/** The full catalog as it looks on one provider (palette, search, etc.). */
export function resolveCatalog(provider: CloudProvider): ResolvedSpec[] {
  return CATALOG.map((c) => resolve(c, provider));
}

export function specFor(type: string, provider: CloudProvider = "aws"): ResolvedSpec | undefined {
  const spec = CATALOG_BY_TYPE[type];
  return spec ? resolve(spec, provider) : undefined;
}
