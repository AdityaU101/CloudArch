export type Provider = 'aws' | 'azure' | 'gcp'

export type Kind =
  | 'client' | 'devices' | 'dns' | 'cdn' | 'waf' | 'lb' | 'compute' | 'cache' | 'db'
  | 'storage' | 'queue' | 'worker' | 'auth' | 'monitor' | 'stream' | 'warehouse'

export const providers: { id: Provider; label: string; name: string; region: string }[] = [
  { id: 'aws', label: 'AWS', name: 'Amazon Web Services', region: 'us-east-1' },
  { id: 'azure', label: 'Azure', name: 'Microsoft Azure', region: 'eastus2' },
  { id: 'gcp', label: 'Google Cloud', name: 'Google Cloud', region: 'us-central1' },
]

/** Service name per provider. `client` and `devices` sit outside the cloud boundary. */
export const serviceName: Record<Kind, Record<Provider, string>> = {
  client: { aws: 'Users', azure: 'Users', gcp: 'Users' },
  devices: { aws: 'IoT devices', azure: 'IoT devices', gcp: 'IoT devices' },
  dns: { aws: 'Route 53', azure: 'Azure DNS', gcp: 'Cloud DNS' },
  cdn: { aws: 'CloudFront', azure: 'Front Door', gcp: 'Cloud CDN' },
  waf: { aws: 'AWS WAF', azure: 'Azure WAF', gcp: 'Cloud Armor' },
  lb: { aws: 'Application LB', azure: 'App Gateway', gcp: 'Cloud Load Balancing' },
  compute: { aws: 'EKS', azure: 'AKS', gcp: 'GKE' },
  cache: { aws: 'ElastiCache', azure: 'Azure Cache for Redis', gcp: 'Memorystore' },
  db: { aws: 'RDS PostgreSQL', azure: 'Azure PostgreSQL', gcp: 'Cloud SQL' },
  storage: { aws: 'S3', azure: 'Blob Storage', gcp: 'Cloud Storage' },
  queue: { aws: 'SQS', azure: 'Service Bus', gcp: 'Pub/Sub' },
  worker: { aws: 'Fargate', azure: 'Container Apps', gcp: 'Cloud Run' },
  auth: { aws: 'Cognito', azure: 'Entra External ID', gcp: 'Identity Platform' },
  monitor: { aws: 'CloudWatch', azure: 'Azure Monitor', gcp: 'Cloud Monitoring' },
  stream: { aws: 'Kinesis Data Streams', azure: 'Event Hubs', gcp: 'Pub/Sub' },
  warehouse: { aws: 'Redshift', azure: 'Synapse Analytics', gcp: 'BigQuery' },
}

/** Supporting services referenced by the security and threat-model text. */
export const support: Record<
  'kms' | 'iam' | 'secrets' | 'audit' | 'ddos' | 'workloadId' | 'registry' | 'network',
  Record<Provider, string>
> = {
  kms: { aws: 'AWS KMS', azure: 'Key Vault', gcp: 'Cloud KMS' },
  iam: { aws: 'IAM', azure: 'Entra ID and Azure RBAC', gcp: 'Cloud IAM' },
  secrets: { aws: 'Secrets Manager', azure: 'Key Vault', gcp: 'Secret Manager' },
  audit: { aws: 'CloudTrail', azure: 'Activity Log', gcp: 'Cloud Audit Logs' },
  ddos: { aws: 'Shield', azure: 'DDoS Protection', gcp: 'Cloud Armor adaptive protection' },
  workloadId: { aws: 'IAM Roles for Service Accounts', azure: 'Workload Identity', gcp: 'Workload Identity' },
  registry: { aws: 'ECR', azure: 'ACR', gcp: 'Artifact Registry' },
  network: { aws: 'VPC', azure: 'Virtual Network', gcp: 'VPC' },
}

/**
 * Illustrative monthly cost in USD for a baseline size of each service.
 * These are sample figures for the demo, not quotes from a pricing API.
 */
export const baseCost: Record<Kind, Record<Provider, number>> = {
  client: { aws: 0, azure: 0, gcp: 0 },
  devices: { aws: 0, azure: 0, gcp: 0 },
  dns: { aws: 1, azure: 1, gcp: 1 },
  cdn: { aws: 85, azure: 92, gcp: 80 },
  waf: { aws: 35, azure: 40, gcp: 30 },
  lb: { aws: 28, azure: 32, gcp: 26 },
  compute: { aws: 420, azure: 400, gcp: 390 },
  cache: { aws: 110, azure: 120, gcp: 105 },
  db: { aws: 310, azure: 330, gcp: 295 },
  storage: { aws: 60, azure: 55, gcp: 52 },
  queue: { aws: 12, azure: 15, gcp: 14 },
  worker: { aws: 140, azure: 150, gcp: 120 },
  auth: { aws: 25, azure: 20, gcp: 22 },
  monitor: { aws: 45, azure: 50, gcp: 40 },
  stream: { aws: 95, azure: 110, gcp: 90 },
  warehouse: { aws: 360, azure: 380, gcp: 300 },
}

export const kindGroup: Record<Kind, 'Edge' | 'Compute' | 'Data' | 'Messaging' | 'Platform' | 'External'> = {
  client: 'External', devices: 'External',
  dns: 'Edge', cdn: 'Edge', waf: 'Edge', lb: 'Edge',
  compute: 'Compute', worker: 'Compute',
  cache: 'Data', db: 'Data', storage: 'Data', warehouse: 'Data',
  queue: 'Messaging', stream: 'Messaging',
  auth: 'Platform', monitor: 'Platform',
}
