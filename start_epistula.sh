#!/usr/bin/env bash
#
# start_epistula.sh - Start Epistula Application Containers
#
# Simple script to start all Epistula containers with one command.
# Handles both Docker Compose and individual Dockerfile builds.
#
# Usage: 
#   ./start_epistula.sh           # Start all containers
#   ./start_epistula.sh --stop    # Stop all containers
#   ./start_epistula.sh --restart # Restart all containers
#   ./start_epistula.sh --status  # Show container status
#
# Author: KiselAnton
# License: MIT

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script directory
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly EPISTULA_DIR="${SCRIPT_DIR}/epistula"

# Container configuration
readonly BACKEND_IMAGE="epistula-backend"
readonly FRONTEND_IMAGE="epistula-frontend"
readonly BACKEND_CONTAINER="epistula-backend"
readonly FRONTEND_CONTAINER="epistula-frontend"
readonly BACKEND_PORT="8000"
readonly FRONTEND_PORT="3000"

#==============================================================================
# Helper Functions
#==============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running or you don't have permission"
        log_info "Try: sudo systemctl start docker"
        log_info "Or add your user to docker group: sudo usermod -aG docker \$USER"
        exit 1
    fi
}

show_usage() {
    cat << EOF
Usage: $(basename "$0") [OPTION]

Start, stop, or manage Epistula application containers.

OPTIONS:
    (no option)     Start all containers (default)
    --start         Start all containers
    --stop          Stop all containers
    --restart       Restart all containers
    --status        Show container status
    --logs          Show container logs
    --clean         Stop and remove all containers and images
    --help          Show this help message

EXAMPLES:
    $(basename "$0")              # Start containers
    $(basename "$0") --stop       # Stop containers
    $(basename "$0") --logs       # View logs

EOF
}

#==============================================================================
# Container Management Functions
#==============================================================================

start_with_compose() {
    log_info "Starting containers using Docker Compose..."
    cd "$EPISTULA_DIR"
    
    if docker compose version >/dev/null 2>&1; then
        docker compose up -d --build
    elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose up -d --build
    else
        return 1
    fi
    
    return 0
}

start_backend() {
    log_info "Building backend container..."
    cd "$EPISTULA_DIR"
    
    if [ -f "backend/Dockerfile" ]; then
        docker build -t "$BACKEND_IMAGE" ./backend
        
        # Stop and remove old container if exists
        docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
        
        log_info "Starting backend container on port $BACKEND_PORT..."
        docker run -d \
            --name "$BACKEND_CONTAINER" \
            --restart unless-stopped \
            -p "$BACKEND_PORT:8000" \
            "$BACKEND_IMAGE"
        
        log_success "Backend started at http://localhost:$BACKEND_PORT"
    else
        log_error "Backend Dockerfile not found at backend/Dockerfile"
        return 1
    fi
}

start_frontend() {
    log_info "Building frontend container..."
    cd "$EPISTULA_DIR"
    
    if [ -f "frontend/Dockerfile" ]; then
        docker build -t "$FRONTEND_IMAGE" ./frontend
        
        # Stop and remove old container if exists
        docker rm -f "$FRONTEND_CONTAINER" 2>/dev/null || true
        
        log_info "Starting frontend container on port $FRONTEND_PORT..."
        docker run -d \
            --name "$FRONTEND_CONTAINER" \
            --restart unless-stopped \
            -p "$FRONTEND_PORT:3000" \
            "$FRONTEND_IMAGE"
        
        log_success "Frontend started at http://localhost:$FRONTEND_PORT"
    elif [ -d "frontend" ]; then
        log_warning "Frontend exists but no Dockerfile found, skipping..."
    fi
}

start_containers() {
    log_info "Starting Epistula containers..."
    
    # Try Docker Compose first
    if [ -f "$EPISTULA_DIR/docker-compose.yml" ] || \
       [ -f "$EPISTULA_DIR/compose.yml" ] || \
       [ -f "$EPISTULA_DIR/compose.yaml" ]; then
        if start_with_compose; then
            log_success "All containers started successfully with Docker Compose"
            show_status
            return 0
        else
            log_warning "Docker Compose failed, falling back to individual containers..."
        fi
    fi
    
    # Fall back to individual containers
    start_backend
    start_frontend
    
    log_success "All containers started successfully"
    echo ""
    show_status
}

stop_containers() {
    log_info "Stopping Epistula containers..."
    
    # Try Docker Compose first
    if [ -f "$EPISTULA_DIR/docker-compose.yml" ] || \
       [ -f "$EPISTULA_DIR/compose.yml" ] || \
       [ -f "$EPISTULA_DIR/compose.yaml" ]; then
        cd "$EPISTULA_DIR"
        if docker compose version >/dev/null 2>&1; then
            docker compose down
        elif command -v docker-compose >/dev/null 2>&1; then
            docker-compose down
        fi
    fi
    
    # Stop individual containers
    docker stop "$BACKEND_CONTAINER" 2>/dev/null || true
    docker stop "$FRONTEND_CONTAINER" 2>/dev/null || true
    
    log_success "All containers stopped"
}

restart_containers() {
    log_info "Restarting Epistula containers..."
    stop_containers
    sleep 2
    start_containers
}

show_status() {
    log_info "Container Status:"
    echo ""
    docker ps -a --filter "name=epistula" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    # Show URLs if containers are running
    if docker ps --filter "name=$BACKEND_CONTAINER" --filter "status=running" | grep -q "$BACKEND_CONTAINER"; then
        log_info "Backend API: http://localhost:$BACKEND_PORT"
    fi
    
    if docker ps --filter "name=$FRONTEND_CONTAINER" --filter "status=running" | grep -q "$FRONTEND_CONTAINER"; then
        log_info "Frontend UI: http://localhost:$FRONTEND_PORT"
    fi
}

show_logs() {
    log_info "Container Logs (press Ctrl+C to exit):"
    echo ""
    docker logs -f --tail 100 "$BACKEND_CONTAINER" 2>&1 &
    BACKEND_PID=$!
    docker logs -f --tail 100 "$FRONTEND_CONTAINER" 2>&1 &
    FRONTEND_PID=$!
    
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
    wait
}

clean_containers() {
    log_warning "This will stop and remove all Epistula containers and images!"
    read -p "Are you sure? [y/N]: " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cancelled"
        exit 0
    fi
    
    log_info "Cleaning up..."
    
    # Stop and remove containers
    docker rm -f "$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" 2>/dev/null || true
    
    # Remove images
    docker rmi "$BACKEND_IMAGE" "$FRONTEND_IMAGE" 2>/dev/null || true
    
    # Try compose cleanup
    if [ -f "$EPISTULA_DIR/docker-compose.yml" ] || \
       [ -f "$EPISTULA_DIR/compose.yml" ]; then
        cd "$EPISTULA_DIR"
        docker compose down --rmi all 2>/dev/null || docker-compose down --rmi all 2>/dev/null || true
    fi
    
    log_success "Cleanup complete"
}

#==============================================================================
# Main Execution
#==============================================================================

main() {
    # Check Docker availability
    check_docker
    
    # Parse command line arguments
    case "${1:-start}" in
        --start|start)
            start_containers
            ;;
        --stop|stop)
            stop_containers
            ;;
        --restart|restart)
            restart_containers
            ;;
        --status|status)
            show_status
            ;;
        --logs|logs)
            show_logs
            ;;
        --clean|clean)
            clean_containers
            ;;
        --help|help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
