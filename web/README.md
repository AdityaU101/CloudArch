# CloudArch web demo

A static, browser-only front end for CloudArch. It shows the product flow
(brief → diagram, Terraform, Kubernetes, CI/CD, cost, security, threat model)
on three prepared scenarios, for AWS, Azure and Google Cloud.

It does not call the CloudArch API. The original full-stack app is untouched
in `artifacts/app` and `artifacts/api-server`.

## Run locally

```bash
cd web
npm install
npm run dev
```

## Deploy to Vercel

1. Import the `CloudArch` repository in Vercel.
2. Set **Root Directory** to `web`.
3. Framework preset: Vite (detected from `vercel.json`). Deploy.

## Where things live

- `src/data/scenarios.ts`: the three scenarios (nodes, edges, availability notes)
- `src/data/catalog.ts`: service names and sample costs per provider
- `src/lib/terraform.ts`: Terraform, Kubernetes and pipeline templates
- `src/lib/generate.ts`: brief matching, cost totals, security and STRIDE text

Cost figures are illustrative samples, not live pricing.
