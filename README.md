# Cloud Architecture Supporter

An AI-powered AWS cloud architecture generator. Describe your application requirements in plain English and instantly get a complete, production-ready infrastructure design.

## Features

Given any set of requirements, the AI generates:

| Output | Description |
|---|---|
| **Architecture Diagram** | Color-coded AWS diagram with service relationships |
| **Terraform HCL** | Deployable infrastructure-as-code with all resources |
| **Kubernetes Manifests** | Deployment, Service, HPA, and Ingress YAML |
| **CI/CD Pipeline** | GitHub Actions or AWS CodePipeline definition |
| **Cost Estimate** | Monthly breakdown per service with totals |
| **Security Recommendations** | IAM, WAF, encryption, and compliance guidance |
| **High Availability Plan** | Multi-AZ strategy, auto-scaling, and load balancing |
| **Database Recommendation** | Instance type, size, replication, and backup strategy |
| **Monitoring Setup** | CloudWatch dashboards, alarms, and SNS alerting |
| **Disaster Recovery Plan** | RTO/RPO targets and cross-region failover procedure |

## Tech Stack

- **Frontend** — React 19, Vite, Tailwind CSS, shadcn/ui, Mermaid.js
- **Backend** — Express.js, TypeScript, Node.js
- **AI** — Groq API (`llama-3.3-70b-versatile`)
- **Database** — PostgreSQL via Drizzle ORM
- **Monorepo** — pnpm workspaces

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **pnpm** — `npm install -g pnpm`
- **PostgreSQL** — local install, Docker, or a free cloud instance ([Neon](https://neon.tech) recommended)
- **Groq API key** — free at [console.groq.com](https://console.groq.com)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cloud_arch_db
GROQ_API_KEY=gsk_...
```

**Using Neon (no install needed):** Sign up at [neon.tech](https://neon.tech), create a project, and paste the connection string as `DATABASE_URL`.

**Using Docker locally:**
```bash
docker-compose up -d
# DATABASE_URL=postgresql://postgres:password@localhost:5432/cloud_arch_db
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Push database schema

```bash
cd lib/db
```

**Mac/Linux:**
```bash
DATABASE_URL="your_url_here" pnpm run push
```

**Windows PowerShell:**
```powershell
$env:DATABASE_URL="your_url_here"
pnpm run push
```

```bash
cd ../..
```

### 5. Start the app

You need two terminals running simultaneously.

**Terminal 1 — API server (port 3001)**

Mac/Linux:
```bash
source .env && cd artifacts/api-server && PORT=3001 NODE_ENV=development pnpm run dev
```

Windows PowerShell:
```powershell
$env:DATABASE_URL="your_url_here"
$env:GROQ_API_KEY="your_groq_key"
$env:PORT="3001"
$env:NODE_ENV="development"
cd artifacts/api-server
pnpm run dev
```

**Terminal 2 — Frontend (port 5173)**

Mac/Linux:
```bash
cd artifacts/app && PORT=5173 API_PORT=3001 BASE_PATH=/ pnpm run dev
```

Windows PowerShell:
```powershell
$env:PORT="5173"
$env:API_PORT="3001"
$env:BASE_PATH="/"
cd artifacts/app
pnpm run dev
```

Open **http://localhost:5173** in your browser.

## Project Structure

```
├── artifacts/
│   ├── app/                  # React frontend (Vite + Tailwind)
│   │   └── src/
│   │       ├── components/   # UI components + Mermaid diagram renderer
│   │       └── pages/        # Generate, Architectures, Detail
│   └── api-server/           # Express REST API
│       └── src/
│           ├── routes/       # Architecture CRUD + AI generation (SSE streaming)
│           └── lib/          # Groq client, logger
├── lib/
│   ├── db/                   # Drizzle ORM schema + migrations
│   ├── api-zod/              # Zod request/response validation
│   └── api-client-react/     # TanStack Query hooks (auto-generated)
├── docker-compose.yml        # Local PostgreSQL
├── .env.example
└── pnpm-workspace.yaml
```

## How It Works

1. You describe your application requirements in the text box
2. The frontend sends a POST request to `/api/architectures/generate`
3. The API streams the response from Groq using Server-Sent Events (SSE)
4. Once complete, the full architecture is displayed across 10 tabs
5. Save it to your library to access it later

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GROQ_API_KEY` | Yes | Groq API key from console.groq.com |
| `PORT` | No | API server port (default: 3001) |
| `API_PORT` | No | Used by frontend to proxy /api (default: 3001) |
