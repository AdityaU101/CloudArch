export type CloudProvider = "aws" | "azure" | "gcp";

interface ProviderProfile {
  /** Full marketing name used in prose */
  name: string;
  /** How the architect persona is described */
  persona: string;
  /** Terraform provider block guidance */
  terraform: string;
  /** Managed Kubernetes flavor for manifests */
  kubernetes: string;
  /** Example service names used to anchor the diagram rules */
  diagramExample: string;
  /** Native security tooling the model should reference */
  securityServices: string;
  /** Monitoring stack guidance */
  monitoring: string;
}

const PROFILES: Record<CloudProvider, ProviderProfile> = {
  aws: {
    name: "AWS",
    persona: "an expert AWS cloud architect",
    terraform:
      "Use the hashicorp/aws provider. Reference real services (EC2, ECS/EKS, Lambda, RDS/Aurora, S3, CloudFront, ALB, ElastiCache, SQS/SNS) with real instance types and pricing.",
    kubernetes: "Target Amazon EKS (include an Ingress suited for the AWS Load Balancer Controller).",
    diagramExample: `graph TD
  classDef compute fill:#FF9900,stroke:#E8871D,color:#000,font-weight:bold
  classDef database fill:#3F48CC,stroke:#2E37B8,color:#fff,font-weight:bold
  classDef network fill:#8C4FFF,stroke:#7B3FE4,color:#fff,font-weight:bold
  classDef storage fill:#3F8624,stroke:#2E7218,color:#fff,font-weight:bold
  classDef security fill:#DD344C,stroke:#C2293F,color:#fff,font-weight:bold
  Users([End Users]) --> CDN(CloudFront CDN)
  CDN --> WAF{AWS WAF}
  WAF --> ALB(Application Load Balancer)
  subgraph VPC[AWS VPC]
    ALB --> EC2(EC2 Auto Scaling Group)
    EC2 --> RDS[(RDS Aurora PostgreSQL)]
    EC2 --> Cache(ElastiCache Redis)
    EC2 --> S3[S3 Object Storage]
  end
  class EC2 compute
  class RDS database
  class ALB,WAF network
  class S3 storage`,
    securityServices:
      "IAM, KMS, AWS WAF, GuardDuty, Security Hub, CloudTrail, Secrets Manager, Shield",
    monitoring: "CloudWatch dashboards, alarms, log groups, and SNS alerting",
  },
  azure: {
    name: "Microsoft Azure",
    persona: "an expert Microsoft Azure cloud architect",
    terraform:
      "Use the hashicorp/azurerm provider. Reference real services (Virtual Machines / VM Scale Sets, AKS, Azure Functions, Azure SQL / Cosmos DB, Blob Storage, Front Door, Application Gateway, Azure Cache for Redis, Service Bus) with real SKUs and pricing.",
    kubernetes: "Target Azure Kubernetes Service (include an Ingress suited for Application Gateway Ingress Controller or NGINX).",
    diagramExample: `graph TD
  classDef compute fill:#FF9900,stroke:#E8871D,color:#000,font-weight:bold
  classDef database fill:#3F48CC,stroke:#2E37B8,color:#fff,font-weight:bold
  classDef network fill:#8C4FFF,stroke:#7B3FE4,color:#fff,font-weight:bold
  classDef storage fill:#3F8624,stroke:#2E7218,color:#fff,font-weight:bold
  classDef security fill:#DD344C,stroke:#C2293F,color:#fff,font-weight:bold
  Users([End Users]) --> FD(Azure Front Door)
  FD --> WAF{Azure WAF}
  WAF --> AGW(Application Gateway)
  subgraph VNet[Azure Virtual Network]
    AGW --> VMSS(VM Scale Set)
    VMSS --> SQL[(Azure SQL Database)]
    VMSS --> Cache(Azure Cache for Redis)
    VMSS --> Blob[Blob Storage]
  end
  class VMSS compute
  class SQL database
  class AGW,WAF network
  class Blob storage`,
    securityServices:
      "Microsoft Entra ID, Azure Key Vault, Azure WAF, Microsoft Defender for Cloud, Azure Monitor audit logs, Azure DDoS Protection",
    monitoring: "Azure Monitor dashboards, Log Analytics workspaces, alert rules, and Action Groups",
  },
  gcp: {
    name: "Google Cloud",
    persona: "an expert Google Cloud architect",
    terraform:
      "Use the hashicorp/google provider. Reference real services (Compute Engine, GKE, Cloud Run, Cloud Functions, Cloud SQL / Spanner, Cloud Storage, Cloud CDN, Cloud Load Balancing, Memorystore, Pub/Sub) with real machine types and pricing.",
    kubernetes: "Target Google Kubernetes Engine (include an Ingress suited for GKE Ingress / Gateway API).",
    diagramExample: `graph TD
  classDef compute fill:#FF9900,stroke:#E8871D,color:#000,font-weight:bold
  classDef database fill:#3F48CC,stroke:#2E37B8,color:#fff,font-weight:bold
  classDef network fill:#8C4FFF,stroke:#7B3FE4,color:#fff,font-weight:bold
  classDef storage fill:#3F8624,stroke:#2E7218,color:#fff,font-weight:bold
  classDef security fill:#DD344C,stroke:#C2293F,color:#fff,font-weight:bold
  Users([End Users]) --> CDN(Cloud CDN)
  CDN --> Armor{Cloud Armor}
  Armor --> GLB(Cloud Load Balancing)
  subgraph VPC[Google VPC]
    GLB --> MIG(Managed Instance Group)
    MIG --> SQL[(Cloud SQL PostgreSQL)]
    MIG --> Cache(Memorystore Redis)
    MIG --> GCS[Cloud Storage]
  end
  class MIG compute
  class SQL database
  class GLB,Armor network
  class GCS storage`,
    securityServices:
      "Cloud IAM, Cloud KMS, Cloud Armor, Security Command Center, Cloud Audit Logs, Secret Manager, VPC Service Controls",
    monitoring: "Cloud Monitoring dashboards, log-based metrics, alerting policies, and notification channels",
  },
};

export function resolveProvider(provider?: string): CloudProvider {
  return provider === "azure" || provider === "gcp" ? provider : "aws";
}

export function providerDisplayName(provider: CloudProvider): string {
  return PROFILES[provider].name;
}

/**
 * The threat model is generated as structured JSON (unlike the prose fields)
 * so the UI can render STRIDE tables and a risk matrix; it is stringified
 * before persistence to keep the architectures row all-text.
 */
const THREAT_MODEL_SPEC = `an OBJECT (not a string) with this exact shape:
{
  "attackSurface": "2-4 sentence summary of the externally reachable surface and most exposed components",
  "trustBoundaries": ["Each trust boundary crossed by data, e.g. Internet -> edge, edge -> app subnet, app -> database"],
  "threatActors": ["Relevant actor with one-line motivation, e.g. External attacker - opportunistic exploitation of public endpoints"],
  "attackVectors": ["Concrete vector for THIS architecture, e.g. SQL injection through the public API, credential theft via leaked access keys, SSRF from the app tier to metadata endpoints, public bucket exposure, container escape, DDoS, lateral movement, secrets leakage, privilege escalation"],
  "stride": [
    { "category": "Spoofing|Tampering|Repudiation|Information Disclosure|Denial of Service|Elevation of Privilege", "threat": "specific threat", "component": "affected component", "mitigation": "specific mitigation naming a cloud-native security service" }
  ],
  "riskMatrix": [
    { "risk": "short risk name", "likelihood": "Low|Medium|High", "impact": "Low|Medium|High", "severity": "Low|Medium|High|Critical" }
  ],
  "mitigations": [
    { "recommendation": "actionable mitigation", "service": "the cloud-native security service that implements it" }
  ]
}
Include at least 6 STRIDE entries (cover every category once), 5+ risk matrix rows, and 6+ mitigations.`;

export function buildGenerationSystemPrompt(provider: CloudProvider): string {
  const p = PROFILES[provider];
  return `You are ${p.persona}. Given a set of business/application requirements, you produce a complete, production-ready cloud architecture plan for ${p.name}.

You MUST respond with a JSON object containing EXACTLY these fields (all required; all strings except threatModel):
{
  "title": "Short descriptive title for this architecture",
  "diagram": "A complete Mermaid diagram showing all ${p.name} services and their connections",
  "terraform": "Complete Terraform HCL code with provider config, all resources, variables, and outputs. ${p.terraform}",
  "costEstimate": "Detailed monthly cost breakdown per service with total estimate",
  "securityRecommendations": "Numbered list of security best practices and specific ${p.name} security services to use (${p.securityServices})",
  "highAvailabilityPlan": "Multi-zone / multi-region strategy, load balancing, auto-scaling details",
  "databaseRecommendation": "Specific database service recommendation with instance type, size, backup strategy",
  "kubernetesDeployment": "Complete Kubernetes YAML manifests (Deployment, Service, HPA, Ingress). ${p.kubernetes}",
  "cicdPipeline": "CI/CD pipeline definition using GitHub Actions or the native ${p.name} pipeline service",
  "monitoringSetup": "${p.monitoring}",
  "disasterRecovery": "RTO/RPO targets, backup strategy, cross-region failover procedure",
  "threatModel": ${THREAT_MODEL_SPEC}
}

CRITICAL MERMAID DIAGRAM RULES — follow exactly or the diagram will break:

1. Start with "graph TD" (top-down) — never use flowchart, sequenceDiagram, or graph LR
2. Node IDs: alphanumeric only, no spaces — User, ALB, EC2Auto, RDSPrimary
3. Node labels must NEVER use quotes — write VM(VM Scale Set) NOT VM("VM Scale Set")
4. Use these shapes:
   - Rounded box for services: EC2(EC2 Instances)
   - Cylinder for databases: RDS[(RDS Aurora)]
   - Diamond for decisions: WAF{AWS WAF}
   - Rectangle for groups: IGW[Internet Gateway]
5. Use subgraphs to group by network boundary (public internet, VPC/VNet, availability zones)
6. Arrows: --> with optional label: App -->|writes| Storage
7. Add classDef color blocks right after "graph TD" — copy these EXACTLY:
   classDef compute fill:#FF9900,stroke:#E8871D,color:#000,font-weight:bold
   classDef database fill:#3F48CC,stroke:#2E37B8,color:#fff,font-weight:bold
   classDef network fill:#8C4FFF,stroke:#7B3FE4,color:#fff,font-weight:bold
   classDef storage fill:#3F8624,stroke:#2E7218,color:#fff,font-weight:bold
   classDef security fill:#DD344C,stroke:#C2293F,color:#fff,font-weight:bold
   classDef cache fill:#C7131F,stroke:#A50E18,color:#fff,font-weight:bold
   classDef user fill:#232F3E,stroke:#FF9900,color:#FF9900,font-weight:bold
   classDef messaging fill:#E7157B,stroke:#C4106A,color:#fff,font-weight:bold
8. After all nodes, assign classes: class EC2,Lambda,EKS compute
9. NEVER put quotes anywhere in the diagram string

Example of correct format:
${p.diagramExample}

Be specific and thorough. Use real ${p.name} service names, real instance types, real pricing. Make the Terraform and Kubernetes manifests actually deployable.`;
}

const FORMAT_LABELS: Record<string, string> = {
  terraform: "Terraform HCL",
  cloudformation: "AWS CloudFormation (JSON or YAML)",
  kubernetes: "Kubernetes YAML manifests",
};

export function validationFormatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format;
}

export function buildValidationSystemPrompt(format: string): string {
  return `You are a principal cloud infrastructure reviewer. You audit ${validationFormatLabel(format)} against the AWS Well-Architected Framework and equivalent industry best practices, and you score it honestly — a hardened production stack scores high, a demo with public databases and hardcoded secrets scores low.

You MUST respond with a JSON object containing EXACTLY these fields:
{
  "summary": "3-5 sentence executive summary of the overall posture of this infrastructure",
  "scores": {
    "security": <integer 0-100>,
    "reliability": <integer 0-100>,
    "costEfficiency": <integer 0-100>,
    "scalability": <integer 0-100>,
    "operationalMaturity": <integer 0-100>
  },
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "title": "Short finding title",
      "resource": "the specific resource/block in the source this applies to, or empty string",
      "explanation": "What is wrong and why it matters, referencing the actual code",
      "recommendation": "Concrete fix, with example configuration where useful",
      "wellArchitectedPillar": "Security" | "Reliability" | "Cost Optimization" | "Performance Efficiency" | "Operational Excellence" | "Sustainability" | ""
    }
  ]
}

Systematically check for at least these issue classes (report only what actually applies to the given source):
- Publicly accessible resources (0.0.0.0/0 ingress, public buckets/databases, public IPs on data stores)
- Missing encryption at rest or in transit (unencrypted volumes, buckets, databases, plaintext protocols)
- Missing backups or retention (no snapshots, backup_retention_period = 0, no PVC backups)
- Overly permissive IAM (wildcard actions/resources, admin policies, missing least privilege, permissive service accounts)
- Lack of Multi-AZ / multi-zone redundancy (single instance, single AZ subnets, replicas = 1)
- Missing logging and audit trails (no access logs, flow logs, CloudTrail, or audit sinks)
- Weak networking (no segmentation, everything in public subnets, missing security groups/network policies)
- Missing monitoring and alerting (no alarms, probes, or health checks)
- Hardcoded secrets and credentials in the source
- Poor availability (no autoscaling, no health checks, no PodDisruptionBudget, single replicas)
- Unnecessary cost (oversized instances, unattached volumes, missing lifecycle policies, no autoscaling floor/ceiling)

Rules:
- Every finding must reference what you actually saw in the source; never invent resources that are not there.
- Order findings by severity (critical first).
- Map each finding to a Well-Architected pillar when applicable.
- If the source is empty, truncated, or not valid ${validationFormatLabel(format)}, say so in the summary, score conservatively, and report it as a finding.`;
}
