#!/usr/bin/env bash
set -euo pipefail

SKIP_RESTART=${1:-}

info(){ echo -e "\033[36m[verify]\033[0m $*"; }
err(){ echo -e "\033[31m[verify]\033[0m $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
info "Repo root: $REPO_ROOT"

if [[ "$SKIP_RESTART" != "--skip-restart" ]]; then
  info "Rebuilding and restarting backend and frontend containers..."
  pushd "$REPO_ROOT" >/dev/null
  docker compose up -d --build frontend backend
  popd >/dev/null

  info "Waiting for backend health..."
  for i in {1..20}; do
    if curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  info "Waiting for frontend health..."
  for i in {1..20}; do
    if curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

info "Running backend tests..."
pushd "$REPO_ROOT/epistula/backend" >/dev/null
python -m pytest -q --tb=short
popd >/dev/null

info "All good."
