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

export interface ComponentSpec {
  /** Stable catalog key, e.g. "ec2". */
  type: string;
  label: string;
  category: CategoryId;
  icon: LucideIcon;
  /** Representative on-demand cost per month, in USD. Illustrative, not a quote. */
  monthly: number;
  /** One-line "what it's for", written for the person, not the system. */
  blurb: string;
  /** Capability tags the insights engine reasons over. */
  tags: CapabilityTag[];
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

export const CATALOG: ComponentSpec[] = [
  // Compute
  { type: "ec2", label: "EC2 Instance", category: "compute", icon: Server, monthly: 62, blurb: "A virtual server you manage yourself.", tags: ["compute"] },
  { type: "asg", label: "Auto Scaling Group", category: "compute", icon: Cpu, monthly: 0, blurb: "Adds and removes servers as traffic changes.", tags: ["autoscale"] },
  { type: "ecs", label: "ECS / Fargate", category: "compute", icon: Container, monthly: 48, blurb: "Runs containers without managing servers.", tags: ["compute", "autoscale"] },
  { type: "eks", label: "EKS Cluster", category: "compute", icon: Boxes, monthly: 146, blurb: "Managed Kubernetes for container workloads.", tags: ["compute", "autoscale", "managed-ha"] },
  { type: "lambda", label: "Lambda Function", category: "compute", icon: Zap, monthly: 8, blurb: "Runs code on demand and scales to zero.", tags: ["compute", "serverless", "autoscale"] },

  // Networking
  { type: "alb", label: "Application Load Balancer", category: "network", icon: Waypoints, monthly: 22, blurb: "Spreads traffic across healthy instances.", tags: ["entrypoint", "managed-ha"] },
  { type: "apigw", label: "API Gateway", category: "network", icon: DoorOpen, monthly: 14, blurb: "Managed front door for your APIs.", tags: ["entrypoint", "serverless", "managed-ha"] },
  { type: "cloudfront", label: "CloudFront CDN", category: "network", icon: Globe, monthly: 30, blurb: "Serves content from edge locations worldwide.", tags: ["cdn", "entrypoint", "managed-ha"] },
  { type: "route53", label: "Route 53", category: "network", icon: Route, monthly: 2, blurb: "DNS and health-checked routing.", tags: ["managed-ha"] },
  { type: "vpc", label: "VPC / Subnets", category: "network", icon: Network, monthly: 0, blurb: "Your private, isolated network.", tags: ["private-network"] },

  // Database
  { type: "rds", label: "RDS (PostgreSQL)", category: "database", icon: Database, monthly: 128, blurb: "Managed relational database.", tags: ["stateful"] },
  { type: "aurora", label: "Aurora Cluster", category: "database", icon: Database, monthly: 210, blurb: "High-throughput, replicated relational DB.", tags: ["stateful", "managed-ha"] },
  { type: "dynamodb", label: "DynamoDB", category: "database", icon: Layers, monthly: 26, blurb: "Serverless key-value store that scales flat.", tags: ["stateful", "serverless", "managed-ha", "autoscale"] },
  { type: "elasticache", label: "ElastiCache (Redis)", category: "database", icon: Zap, monthly: 54, blurb: "In-memory cache in front of your database.", tags: ["cache"] },

  // Storage
  { type: "s3", label: "S3 Bucket", category: "storage", icon: Archive, monthly: 18, blurb: "Durable object storage for files and backups.", tags: ["object-store", "managed-ha"] },
  { type: "ebs", label: "EBS Volume", category: "storage", icon: HardDrive, monthly: 12, blurb: "Block storage attached to an instance.", tags: [] },
  { type: "backup", label: "AWS Backup", category: "storage", icon: Archive, monthly: 9, blurb: "Scheduled, retained backups for recovery.", tags: ["backup"] },

  // Security
  { type: "waf", label: "WAF", category: "security", icon: Shield, monthly: 16, blurb: "Filters malicious web traffic.", tags: ["waf"] },
  { type: "cognito", label: "Cognito", category: "security", icon: UserCheck, monthly: 0, blurb: "User sign-up, sign-in, and tokens.", tags: ["identity"] },
  { type: "secrets", label: "Secrets Manager", category: "security", icon: KeyRound, monthly: 4, blurb: "Stores and rotates credentials safely.", tags: ["secrets"] },
  { type: "kms", label: "KMS Encryption", category: "security", icon: Lock, monthly: 3, blurb: "Manages encryption keys for data at rest.", tags: ["encryption"] },

  // Integration
  { type: "sqs", label: "SQS Queue", category: "integration", icon: Radio, monthly: 5, blurb: "Buffers work between services.", tags: ["queue", "serverless"] },
  { type: "cloudwatch", label: "CloudWatch", category: "integration", icon: Activity, monthly: 11, blurb: "Metrics, logs, and alarms.", tags: ["observability"] },
];

export const CATALOG_BY_TYPE: Record<string, ComponentSpec> = Object.fromEntries(
  CATALOG.map((c) => [c.type, c]),
);

export function specFor(type: string): ComponentSpec | undefined {
  return CATALOG_BY_TYPE[type];
}
