import type { Kind, Provider } from '../data/catalog'
import type { NodeSpec, Scenario } from '../data/scenarios'

type Snippet = (n: NodeSpec, s: Scenario) => string

const header: Record<Provider, (s: Scenario) => string> = {
  aws: (s) => `terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.60" }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { project = "${s.slug}", managed_by = "terraform" }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name            = "${s.slug}"
  cidr            = "10.20.0.0/16"
  azs             = ["\${var.region}a", "\${var.region}b", "\${var.region}c"]
  private_subnets = ["10.20.0.0/20", "10.20.16.0/20", "10.20.32.0/20"]
  public_subnets  = ["10.20.96.0/24", "10.20.97.0/24", "10.20.98.0/24"]

  enable_nat_gateway = true
}`,
  azure: (s) => `terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  type    = string
  default = "eastus2"
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${s.slug}"
  location = var.location
  tags     = { project = "${s.slug}", managed_by = "terraform" }
}

resource "azurerm_virtual_network" "main" {
  name                = "vnet-${s.slug}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "private" {
  name                 = "snet-private"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.0.0/20"]
}`,
  gcp: (s) => `terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

provider "google" {
  project = var.project
  region  = var.region
}

variable "project" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

resource "google_compute_network" "main" {
  name                    = "${s.slug}"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  name                     = "${s.slug}-private"
  network                  = google_compute_network.main.id
  region                   = var.region
  ip_cidr_range            = "10.20.0.0/20"
  private_ip_google_access = true
}`,
}

const isReplica = (n: NodeSpec) => n.id === 'replica'

const snippets: Record<Provider, Partial<Record<Kind, Snippet>>> = {
  aws: {
    compute: (n, s) => `module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "${s.slug}"
  cluster_version = "1.30"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets

  eks_managed_node_groups = {
    ${n.id} = {
      instance_types = ["m6i.large"]
      min_size       = 3
      max_size       = 12
      desired_size   = 3
    }
  }
}`,
    db: (n, s) =>
      isReplica(n)
        ? `resource "aws_db_instance" "replica" {
  count               = 2
  identifier          = "${s.slug}-replica-\${count.index}"
  replicate_source_db = aws_db_instance.db.identifier
  instance_class      = "db.r6g.large"
  storage_encrypted   = true
}`
        : `resource "aws_db_subnet_group" "main" {
  name       = "${s.slug}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_db_instance" "${n.id}" {
  identifier        = "${s.slug}"
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = "db.r6g.large"
  allocated_storage = 100

  multi_az                    = true
  storage_encrypted           = true
  manage_master_user_password = true
  backup_retention_period     = 7
  deletion_protection         = true
  db_subnet_group_name        = aws_db_subnet_group.main.name
}`,
    cache: (n, s) => `resource "aws_elasticache_replication_group" "${n.id}" {
  replication_group_id = "${s.slug}"
  description          = "${n.role}"
  engine               = "redis"
  node_type            = "cache.r6g.large"
  num_cache_clusters   = 2

  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}`,
    storage: (n, s) => `resource "aws_s3_bucket" "${n.id}" {
  bucket = "${s.slug}-${n.id}"
}

resource "aws_s3_bucket_versioning" "${n.id}" {
  bucket = aws_s3_bucket.${n.id}.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "${n.id}" {
  bucket                  = aws_s3_bucket.${n.id}.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`,
    queue: (n, s) => `resource "aws_sqs_queue" "${n.id}" {
  name                       = "${s.slug}-${n.id}"
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled    = true
}`,
    stream: (n, s) => `resource "aws_kinesis_stream" "${n.id}" {
  name             = "${s.slug}-${n.id}"
  retention_period = 24
  encryption_type  = "KMS"
  kms_key_id       = "alias/aws/kinesis"

  stream_mode_details {
    stream_mode = "ON_DEMAND"
  }
}`,
  },
  azure: {
    compute: (n, s) => `resource "azurerm_kubernetes_cluster" "main" {
  name                = "aks-${s.slug}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  dns_prefix          = "${s.slug}"

  default_node_pool {
    name                 = "${n.id}"
    vm_size              = "Standard_D4s_v5"
    auto_scaling_enabled = true
    min_count            = 3
    max_count            = 12
    zones                = ["1", "2", "3"]
    vnet_subnet_id       = azurerm_subnet.private.id
  }

  identity {
    type = "SystemAssigned"
  }
}`,
    db: (n, s) =>
      isReplica(n)
        ? `resource "azurerm_postgresql_flexible_server" "replica" {
  count               = 2
  name                = "psql-${s.slug}-replica-\${count.index}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  create_mode         = "Replica"
  source_server_id    = azurerm_postgresql_flexible_server.db.id
}`
        : `resource "azurerm_postgresql_flexible_server" "${n.id}" {
  name                = "psql-${s.slug}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  version             = "16"
  sku_name            = "GP_Standard_D4s_v3"
  storage_mb          = 131072
  zone                = "1"

  backup_retention_days = 7

  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = "2"
  }
}`,
    cache: (n, s) => `resource "azurerm_redis_cache" "${n.id}" {
  name                = "redis-${s.slug}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_name            = "Premium"
  family              = "P"
  capacity            = 1
  minimum_tls_version = "1.2"
}`,
    storage: (n, s) => `resource "azurerm_storage_account" "${n.id}" {
  name                     = "st${s.slug.replace(/-/g, '')}${n.id}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    versioning_enabled = true
  }
}`,
    queue: (n, s) => `resource "azurerm_servicebus_namespace" "main" {
  name                = "sb-${s.slug}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"
}

resource "azurerm_servicebus_queue" "${n.id}" {
  name         = "${n.id}"
  namespace_id = azurerm_servicebus_namespace.main.id
}`,
    stream: (n, s) => `resource "azurerm_eventhub_namespace" "main" {
  name                = "evh-${s.slug}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"
  capacity            = 2
}

resource "azurerm_eventhub" "${n.id}" {
  name              = "${n.id}"
  namespace_id      = azurerm_eventhub_namespace.main.id
  partition_count   = 8
  message_retention = 1
}`,
  },
  gcp: {
    compute: (_n, s) => `resource "google_container_cluster" "main" {
  name             = "${s.slug}"
  location         = var.region
  network          = google_compute_network.main.id
  subnetwork       = google_compute_subnetwork.private.id
  enable_autopilot = true

  release_channel {
    channel = "REGULAR"
  }
}`,
    db: (n, s) =>
      isReplica(n)
        ? `resource "google_sql_database_instance" "replica" {
  count                = 2
  name                 = "${s.slug}-replica-\${count.index}"
  region               = var.region
  database_version     = "POSTGRES_16"
  master_instance_name = google_sql_database_instance.db.name

  settings {
    tier = "db-custom-4-16384"
  }
}`
        : `resource "google_sql_database_instance" "${n.id}" {
  name                = "${s.slug}"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true

  settings {
    tier              = "db-custom-4-16384"
    availability_type = "REGIONAL"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }
  }
}`,
    cache: (n, s) => `resource "google_redis_instance" "${n.id}" {
  name                    = "${s.slug}"
  region                  = var.region
  tier                    = "STANDARD_HA"
  memory_size_gb          = 5
  authorized_network      = google_compute_network.main.id
  transit_encryption_mode = "SERVER_AUTHENTICATION"
}`,
    storage: (n, s) => `resource "google_storage_bucket" "${n.id}" {
  name                        = "\${var.project}-${s.slug}-${n.id}"
  location                    = "US"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }
}`,
    queue: (n, s) => `resource "google_pubsub_topic" "${n.id}" {
  name = "${s.slug}-${n.id}"
}

resource "google_pubsub_subscription" "${n.id}" {
  name                 = "${s.slug}-${n.id}"
  topic                = google_pubsub_topic.${n.id}.id
  ack_deadline_seconds = 600
}`,
    stream: (n, s) => `resource "google_pubsub_topic" "${n.id}" {
  name                       = "${s.slug}-${n.id}"
  message_retention_duration = "86400s"
}`,
  },
}

export function buildTerraform(s: Scenario, p: Provider): string {
  const blocks = s.nodes.map((n) => snippets[p][n.kind]?.(n, s)).filter(Boolean)
  return [
    `# ${s.title}: core infrastructure\n# Demo excerpt. Edge, identity and observability modules are left out for length.`,
    header[p](s),
    ...blocks,
  ].join('\n\n')
}

export function buildKubernetes(s: Scenario, p: Provider): string {
  const ingress = {
    aws: ['alb', 'alb.ingress.kubernetes.io/scheme: internet-facing\n    alb.ingress.kubernetes.io/target-type: ip'],
    azure: ['azure-application-gateway', 'appgw.ingress.kubernetes.io/ssl-redirect: "true"'],
    gcp: ['gce', 'kubernetes.io/ingress.global-static-ip-name: ' + s.slug],
  }[p]
  const image = {
    aws: `123456789012.dkr.ecr.us-east-1.amazonaws.com/${s.slug}/api:1.0.0`,
    azure: `${s.slug.replace(/-/g, '')}.azurecr.io/api:1.0.0`,
    gcp: `us-central1-docker.pkg.dev/my-project/${s.slug}/api:1.0.0`,
  }[p]
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels: { app: ${s.slug}, tier: api }
spec:
  replicas: 3
  selector:
    matchLabels: { app: ${s.slug}, tier: api }
  template:
    metadata:
      labels: { app: ${s.slug}, tier: api }
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels: { app: ${s.slug}, tier: api }
      containers:
        - name: api
          image: ${image}
          ports:
            - containerPort: 8080
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits: { cpu: "1", memory: 1Gi }
          readinessProbe:
            httpGet: { path: /healthz, port: 8080 }
            periodSeconds: 5
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector: { app: ${s.slug}, tier: api }
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 12
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 65 }
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  annotations:
    ${ingress[1]}
spec:
  ingressClassName: ${ingress[0]}
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port: { number: 80 }`
}

export function buildPipeline(s: Scenario, p: Provider): string {
  const auth = {
    aws: `      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ vars.AWS_DEPLOY_ROLE }}
          aws-region: us-east-1
      - uses: aws-actions/amazon-ecr-login@v2
        id: registry`,
    azure: `      - uses: azure/login@v2
        with:
          client-id: \${{ vars.AZURE_CLIENT_ID }}
          tenant-id: \${{ vars.AZURE_TENANT_ID }}
          subscription-id: \${{ vars.AZURE_SUBSCRIPTION_ID }}
      - run: az acr login --name \${{ vars.ACR_NAME }}`,
    gcp: `      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: \${{ vars.GCP_WIF_PROVIDER }}
          service_account: \${{ vars.GCP_DEPLOY_SA }}
      - run: gcloud auth configure-docker us-central1-docker.pkg.dev`,
  }[p]
  const kube = {
    aws: `aws eks update-kubeconfig --name ${s.slug}`,
    azure: `az aks get-credentials --resource-group rg-${s.slug} --name aks-${s.slug}`,
    gcp: `gcloud container clusters get-credentials ${s.slug} --region us-central1`,
  }[p]
  return `name: deploy

on:
  push:
    branches: [main]
  pull_request:

permissions:
  id-token: write   # keyless cloud auth through OIDC
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test

  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
${auth}
      - run: terraform -chdir=infra init
      - run: terraform -chdir=infra plan -out=tfplan

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [test, plan]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
${auth}
      - run: docker build -t "$IMAGE:\${{ github.sha }}" .
      - run: docker push "$IMAGE:\${{ github.sha }}"
      - run: ${kube}
      - run: kubectl set image deployment/api api="$IMAGE:\${{ github.sha }}"
      - run: kubectl rollout status deployment/api --timeout=180s`
}
