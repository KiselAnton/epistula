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

# Root user runtime configuration (forwarded to backend container)
ROOT_EMAIL_DEFAULT="root@localhost"
ROOT_NAME_DEFAULT="root"
ROOT_ALLOWED_IPS_DEFAULT="127.0.0.1,::1,172.17.0.1"

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

random_password() {
    # 24-char random base64 password
    openssl rand -base64 18 2>/dev/null || cat /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 24
}

ensure_root_env() {
    # Use existing env values if provided by caller
    export EPISTULA_ROOT_EMAIL="${EPISTULA_ROOT_EMAIL:-$ROOT_EMAIL_DEFAULT}"
    export EPISTULA_ROOT_NAME="${EPISTULA_ROOT_NAME:-$ROOT_NAME_DEFAULT}"
    export EPISTULA_ROOT_ALLOWED_IPS="${EPISTULA_ROOT_ALLOWED_IPS:-$ROOT_ALLOWED_IPS_DEFAULT}"

    if [ -z "${EPISTULA_ROOT_PASSWORD:-}" ]; then
        if [ "${FORCE_INSTALL:-0}" -eq 1 ]; then
            EPISTULA_ROOT_PASSWORD="$(random_password)"
            log_warning "No EPISTULA_ROOT_PASSWORD provided. Generated temporary password."
        else
            read -p "Set root password (blank to auto-generate): " -r ROOT_PW_INPUT
            if [ -z "$ROOT_PW_INPUT" ]; then
                EPISTULA_ROOT_PASSWORD="$(random_password)"
                log_warning "Generated temporary root password."
            else
                EPISTULA_ROOT_PASSWORD="$ROOT_PW_INPUT"
            fi
        fi
        export EPISTULA_ROOT_PASSWORD
        log_info "root email: $EPISTULA_ROOT_EMAIL | Allowed IPs: $EPISTULA_ROOT_ALLOWED_IPS"
    fi
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
        ensure_root_env
        docker build -t "$BACKEND_IMAGE" ./backend
        
        # Stop and remove old container if exists
        docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
        
        log_info "Starting backend container on port $BACKEND_PORT..."
        docker run -d \
            --name "$BACKEND_CONTAINER" \
            --restart unless-stopped \
            -e EPISTULA_ROOT_EMAIL="$EPISTULA_ROOT_EMAIL" \
            -e EPISTULA_ROOT_NAME="$EPISTULA_ROOT_NAME" \
            -e EPISTULA_ROOT_PASSWORD="$EPISTULA_ROOT_PASSWORD" \
            -e EPISTULA_ROOT_ALLOWED_IPS="$EPISTULA_ROOT_ALLOWED_IPS" \
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

check_and_install_requirements() {
    FORCE=0
    if [[ "${1:-}" == "--force" ]]; then
        FORCE=1
    fi

    # System requirements - check commands and map to package names
    MISSING_CMDS=()
    MISSING_PKGS=()
    
    if ! command -v docker >/dev/null 2>&1; then
        MISSING_CMDS+=("docker")
        MISSING_PKGS+=("docker.io")
    fi
    
    if ! command -v python3 >/dev/null 2>&1; then
        MISSING_CMDS+=("python3")
        MISSING_PKGS+=("python3")
    fi
    
    if ! command -v pip3 >/dev/null 2>&1; then
        MISSING_CMDS+=("pip3")
        MISSING_PKGS+=("python3-pip")
    fi

    if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
        log_warning "Missing system packages: ${MISSING_CMDS[*]}"
        if [ "$FORCE" -eq 1 ]; then
            log_info "Installing missing system packages..."
            sudo apt update
            sudo apt install -y ${MISSING_PKGS[*]}
        else
            read -p "Install missing system packages? [y/N]: " -n 1 -r; echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo apt update
                sudo apt install -y ${MISSING_PKGS[*]}
            else
                log_error "Cannot continue without required system packages."
                exit 1
            fi
        fi
    fi

    # Python requirements
    if [ -f "$EPISTULA_DIR/backend/requirements.txt" ]; then
        if ! python3 -m pip show uvicorn >/dev/null 2>&1; then
            log_warning "Python package 'uvicorn' is missing."
            
            # Try to install via apt first (for externally-managed environments)
            APT_PKGS=("python3-uvicorn" "python3-fastapi" "python3-pydantic")
            
            if [ "$FORCE" -eq 1 ]; then
                log_info "Installing Python requirements via apt..."
                sudo apt install -y ${APT_PKGS[*]} 2>/dev/null
                
                # If apt install fails or packages not available, try pip with --break-system-packages
                if ! python3 -m pip show uvicorn >/dev/null 2>&1; then
                    log_info "Falling back to pip installation..."
                    python3 -m pip install --break-system-packages -r "$EPISTULA_DIR/backend/requirements.txt" 2>/dev/null || \
                    sudo python3 -m pip install --break-system-packages -r "$EPISTULA_DIR/backend/requirements.txt"
                fi
            else
                read -p "Install Python requirements? [y/N]: " -n 1 -r; echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    log_info "Installing Python requirements via apt..."
                    sudo apt install -y ${APT_PKGS[*]} 2>/dev/null
                    
                    # If apt install fails, try pip
                    if ! python3 -m pip show uvicorn >/dev/null 2>&1; then
                        log_info "Falling back to pip installation..."
                        python3 -m pip install --break-system-packages -r "$EPISTULA_DIR/backend/requirements.txt" 2>/dev/null || \
                        sudo python3 -m pip install --break-system-packages -r "$EPISTULA_DIR/backend/requirements.txt"
                    fi
                else
                    log_error "Cannot continue without required Python packages."
                    exit 1
                fi
            fi
        fi
    fi
}

main() {
    # Check and install requirements
    if [[ "${1:-}" == "--force" ]]; then
        check_and_install_requirements --force
        shift
    else
        check_and_install_requirements
    fi

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
