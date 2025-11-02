#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)" || { echo "Not a git repo" >&2; exit 1; }
cd "$ROOT_DIR"
echo "[hooks] Setting core.hooksPath to .githooks"
git config core.hooksPath .githooks
chmod +x .githooks/* || true
echo "[hooks] Hooks installed."
