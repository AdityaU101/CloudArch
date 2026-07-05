---
name: verify
description: Build, launch, and drive CloudArch locally to verify changes end-to-end.
---

# Verifying CloudArch

Monorepo: Express API (`artifacts/api-server`) + Vite React app (`artifacts/app`). Env comes from `.env` at repo root (DATABASE_URL → Neon, GROQ_API_KEY).

## Launch (Git Bash)

```bash
# API (pick a free port; 3001 may be occupied by a long-running dev server)
set -a; source .env; set +a
cd artifacts/api-server && PORT=3002 NODE_ENV=development pnpm run dev

# Frontend (MSYS_NO_PATHCONV stops Git Bash mangling BASE_PATH=/)
cd artifacts/app && MSYS_NO_PATHCONV=1 PORT=5174 API_PORT=3002 BASE_PATH=/ pnpm run dev
```

Health check: `curl http://localhost:3002/api/healthz` → `{"status":"ok"}`; app at `http://localhost:5174`.

## Gotchas

- Ports 3001/5173 are often already held by a stale dev server running OLD code — probe a changed route first (`Cannot POST ...` means stale); use alternate ports rather than killing processes you don't own.
- `pnpm run dev` in api-server builds then runs; there is no watch mode — restart to pick up server changes.
- SSE endpoints (`/api/architectures/generate`, `/api/validations/analyze`) stream `data: {"type":"chunk"|"done"|"error",...}` records; drive with `curl -N -X POST` and grep for `"type":"done"`. Generation takes 30–90s (real Groq call).
- Schema changes: `cd lib/db && pnpm run push` (needs DATABASE_URL exported).
- API contract changes: edit `lib/api-spec/openapi.yaml`, then `cd lib/api-spec && pnpm run codegen` (regenerates api-zod + api-client-react and typechecks libs).

## Flows worth driving

- Generate page (`/`): provider toggle → Generate → streaming card → tabbed result → Save.
- Validate page (`/validate`): paste bad Terraform (public bucket, hardcoded secret, `publicly_accessible = true`) → scores + findings.
- Library (`/architectures`) → detail → each tab, incl. Threat Model (structured JSON; older rows show a fallback message).
