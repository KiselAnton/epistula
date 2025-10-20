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

# Store the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Repository location: $SCRIPT_DIR"
echo ""

# Pull latest code from repository
echo "[1/4] Pulling latest code from repository..."
cd "$SCRIPT_DIR"
git fetch origin
git pull origin master
echo "✓ Code updated successfully"
echo ""

# Check if backend service exists and is running
echo "[2/4] Checking backend service..."
if systemctl is-active --quiet epistula-backend 2>/dev/null; then
    echo "Backend service is running, restarting..."
    systemctl restart epistula-backend
    echo "✓ Backend service restarted"
elif [ -f "$SCRIPT_DIR/epistula/backend/main.py" ]; then
    echo "Backend files found but service not running"
    echo "To start the backend service manually, run:"
    echo "  cd $SCRIPT_DIR/epistula/backend && uvicorn main:app --host 0.0.0.0 --port 8000"
else
    echo "⚠ No backend service found (skipping)"
fi
echo ""

# Rebuild Docker containers if docker-compose is present
echo "[3/4] Checking for Docker setup..."
if [ -f "$SCRIPT_DIR/docker-compose.yml" ] || [ -f "$SCRIPT_DIR/epistula/backend/Dockerfile" ]; then
    if command -v docker &> /dev/null; then
        echo "Docker found, rebuilding containers..."
        if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
            docker-compose down
            docker-compose up -d --build
            echo "✓ Docker containers rebuilt and restarted"
        else
            echo "Dockerfile found but no docker-compose.yml"
            echo "To build manually: cd $SCRIPT_DIR/epistula/backend && docker build -t epistula-backend ."
        fi
    else
        echo "⚠ Docker not installed (skipping)"
    fi
else
    echo "⚠ No Docker setup found (skipping)"
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
