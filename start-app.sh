#!/bin/bash
set -a; source .env; set +a
cd artifacts/app
PORT=5173 API_PORT=3001 BASE_PATH=/ pnpm run dev
