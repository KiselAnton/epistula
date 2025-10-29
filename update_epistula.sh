#!/bin/bash

# Epistula Update Script
# This script pulls the latest code from the repository and restarts services

set -e  # Exit on error

echo "====================================="
echo "Epistula Update Script"
echo "====================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root or with sudo"
    echo "Usage: sudo ./update_epistula.sh"
    exit 1
fi

# Parse options
BRANCH_DEFAULT="${EPISTULA_UPDATE_BRANCH:-${EPISTULA_BRANCH:-master}}"
BRANCH="$BRANCH_DEFAULT"
FORCE=0
AUTO_STASH=auto

usage() {
        cat <<EOF
Usage: sudo ./update_epistula.sh [--branch <name>] [--force] [--no-stash] | [<branch>]

Options:
    -b, --branch <name>   Branch to pull from (default: $BRANCH_DEFAULT)
        -f, --force           Do not prompt; auto-stash dirty changes before pulling
        --no-stash            Do not stash; abort if working tree is dirty
        -h, --help            Show this help

Environment variables:
    EPISTULA_UPDATE_BRANCH or EPISTULA_BRANCH can also set the default branch.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -b|--branch)
            BRANCH="$2"; shift 2 ;;
        -f|--force)
                FORCE=1; shift ;;
            --no-stash)
                AUTO_STASH=none; shift ;;
            -h|--help)
            usage; exit 0 ;;
        *)
            # Positional branch name
            if [[ -z "$BRANCH" || "$BRANCH" == "$BRANCH_DEFAULT" ]]; then
                BRANCH="$1"; shift;
            else
                echo "Unknown argument: $1"; usage; exit 1
            fi
            ;;
    esac
done

# Store the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Repository location: $SCRIPT_DIR"
echo "Using branch: $BRANCH"
echo ""

# Pull latest code from a specific branch
echo "[1/4] Pulling latest code from repository (branch: $BRANCH)..."
cd "$SCRIPT_DIR"

# Avoid interactive git prompts in non-interactive environments (e.g., WSL root)
export GIT_TERMINAL_PROMPT=0

# Check working tree status and stash if needed
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    if [ "$AUTO_STASH" = "none" ]; then
        echo "Working tree has local changes. Aborting because --no-stash was provided."
        exit 1
    fi
    if [ $FORCE -eq 1 ]; then
        DO_STASH=yes
    else
        read -p "Local changes detected. Stash them before pulling? [Y/n]: " -r REPLY
        if [[ "$REPLY" =~ ^[Nn]$ ]]; then
            DO_STASH=no
        else
            DO_STASH=yes
        fi
    fi
    if [ "$DO_STASH" = "yes" ]; then
        STASHED=1
        git stash push -u -m "epistula-update $(date -Iseconds)" >/dev/null || true
        echo "Saved local changes to stash."
    fi
fi

# Try to fetch remote without blocking for credentials
set +e
git fetch origin "$BRANCH" </dev/null
FETCH_RC=$?
if [ $FETCH_RC -ne 0 ]; then
    git fetch origin </dev/null
    FETCH_RC=$?
fi
set -e

if [ $FETCH_RC -ne 0 ]; then
    echo "⚠ Could not fetch from remote (possibly due to missing credentials in this shell)."
    echo "  Continuing without pulling latest commits. Local branch will be used."
    SKIP_PULL=1
else
    SKIP_PULL=0
fi

if [ $SKIP_PULL -eq 0 ]; then
    # Checkout or create local tracking branch
    if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
        git checkout "$BRANCH"
    else
        # Create local branch tracking remote if remote exists
        if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
            git checkout -b "$BRANCH" "origin/$BRANCH"
        else
            echo "⚠ Branch '$BRANCH' not found on remote. Staying on current branch $(git rev-parse --abbrev-ref HEAD)."
        fi
    fi

    # Pull latest changes (rebase to keep history clean); this is offline after fetch
    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    git pull --rebase origin "$CURRENT_BRANCH" || git pull origin "$CURRENT_BRANCH"
fi

# Restore stashed changes if any
if [ "${STASHED:-0}" -eq 1 ]; then
    echo "Restoring stashed changes..."
    if ! git stash pop --quiet; then
        echo "⚠ Merge conflicts while applying stashed changes. Please resolve them manually."
    else
        echo "✓ Stashed changes reapplied."
    fi
fi
echo "✓ Code updated successfully"
echo ""

# Check if backend service exists and is running
echo "[2/4] Checking backend service..."
if systemctl is-active --quiet epistula-backend 2>/dev/null; then
    echo "Backend service is running, restarting..."
    systemctl restart epistula-backend
    echo "✓ Backend service restarted"
    elif [ -f "$SCRIPT_DIR/epistula/backend/main.py" ]; then
        echo "Backend files found but service not running. Starting backend automatically..."
        cd "$SCRIPT_DIR/epistula/backend"
        nohup uvicorn main:app --host 0.0.0.0 --port 8000 > "$SCRIPT_DIR/epistula/backend/backend.log" 2>&1 &
        echo "✓ Backend started with uvicorn (see backend.log for output)"
else
    echo "⚠ No backend service found (skipping)"
fi
echo ""

# Rebuild and restart Docker containers
echo "[3/4] Checking for Docker setup..."
if [ -f "$SCRIPT_DIR/start_epistula.sh" ]; then
    if command -v docker &> /dev/null; then
        echo "Docker found, rebuilding and restarting containers..."
        # Stop existing containers
        docker stop epistula-backend epistula-frontend 2>/dev/null || true
        docker rm epistula-backend epistula-frontend 2>/dev/null || true
        
        # Run start script with force flag to rebuild
        bash "$SCRIPT_DIR/start_epistula.sh" --force --restart
        echo "✓ Docker containers rebuilt and restarted"
    else
        echo "⚠ Docker not installed (skipping)"
    fi
else
    echo "⚠ No start_epistula.sh found (skipping)"
fi
echo ""

# Display version information
echo "[4/4] Checking version..."
if [ -f "$SCRIPT_DIR/epistula/backend/VERSION" ]; then
    VERSION=$(cat "$SCRIPT_DIR/epistula/backend/VERSION")
    echo "✓ Updated to version: $VERSION"
else
    echo "⚠ VERSION file not found"
fi
echo ""

echo "====================================="
echo "Update completed successfully!"
echo "====================================="
echo ""
echo "To verify the update:"
echo "  - Check backend health: curl http://localhost:8000/health"
echo "  - Check version: curl http://localhost:8000/version"
echo ""

# Print repo status (branch/commit) for quick visibility
if command -v git >/dev/null 2>&1; then
    GIT_BRANCH=$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    GIT_COMMIT=$(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
    GIT_SUBJ=$(git -C "$SCRIPT_DIR" log -1 --pretty=%s 2>/dev/null || echo "")
    echo "Repo: $GIT_BRANCH @ $GIT_COMMIT ${GIT_SUBJ:+- $GIT_SUBJ}"
fi

