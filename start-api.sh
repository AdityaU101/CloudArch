#!/bin/bash
set -a; source .env; set +a
cd artifacts/api-server
PORT=3001 NODE_ENV=development pnpm run dev
