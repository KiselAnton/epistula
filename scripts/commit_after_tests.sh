#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <commit-message> [--push]" >&2
  exit 1
fi

MESSAGE="$1"
PUSH=${2:-}

info(){ echo -e "\033[36m[commit]\033[0m $*"; }
err(){ echo -e "\033[31m[commit]\033[0m $*"; }

ROOT_DIR="$(git rev-parse --show-toplevel)" || { err "Not a git repo"; exit 1; }
info "Repo root: $ROOT_DIR"

# Clean workspace (preserves ISOs)
if [[ -x "$ROOT_DIR/scripts/clean_workspace.sh" ]]; then
  info "Cleaning workspace via bash script..."
  bash "$ROOT_DIR/scripts/clean_workspace.sh" --stash || true
fi

# Rebuild and restart containers, then health check
info "Rebuilding and restarting containers..."
pushd "$ROOT_DIR" >/dev/null
if command -v docker >/dev/null 2>&1; then
  docker compose up -d --build frontend backend
fi
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

info "Running backend tests..."
pushd "$ROOT_DIR/epistula/backend" >/dev/null
python -m pytest -q --tb=short
popd >/dev/null

info "Staging and committing..."
git add -A
git commit -m "$MESSAGE"

if [[ "$PUSH" == "--push" ]]; then
  info "Pushing branch..."
  git push
fi

info "Done."
