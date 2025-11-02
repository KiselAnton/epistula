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
readonly COMPOSE_DIR="${SCRIPT_DIR}"  # docker-compose.yml is in root
readonly EPISTULA_DIR="${SCRIPT_DIR}/epistula"  # Source code is in epistula/

# Container configuration
readonly BACKEND_IMAGE="epistula-backend"
readonly FRONTEND_IMAGE="epistula-frontend"
readonly BACKEND_CONTAINER="epistula-backend"
readonly FRONTEND_CONTAINER="epistula-frontend"
readonly BACKEND_PORT="8000"
readonly FRONTEND_PORT="3000"

# Root user runtime configuration (forwarded to backend container)
# Default to a valid RFC-like email so backend EmailStr accepts it
ROOT_EMAIL_DEFAULT="root@localhost.localdomain"
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

    local PROMPTED_PASSWORD=0
    if [ -z "${EPISTULA_ROOT_PASSWORD:-}" ]; then
        if [ "${FORCE_INSTALL:-0}" -eq 1 ]; then
            EPISTULA_ROOT_PASSWORD="$(random_password)"
            log_warning "No EPISTULA_ROOT_PASSWORD provided. Generated temporary password."
            PROMPTED_PASSWORD=1
        else
            read -p "Set root password (blank to auto-generate): " -r ROOT_PW_INPUT
            if [ -z "$ROOT_PW_INPUT" ]; then
                EPISTULA_ROOT_PASSWORD="$(random_password)"
                log_warning "Generated temporary root password."
                PROMPTED_PASSWORD=1
            else
                EPISTULA_ROOT_PASSWORD="$ROOT_PW_INPUT"
                PROMPTED_PASSWORD=1
            fi
        fi
        export EPISTULA_ROOT_PASSWORD
        log_info "root email: $EPISTULA_ROOT_EMAIL | Allowed IPs: $EPISTULA_ROOT_ALLOWED_IPS"
    fi

    # Map to backend-expected env var names so docker-compose picks them up
    # Backend reads ROOT_EMAIL and ROOT_PASSWORD (see backend/init_root_user.py)
    export ROOT_EMAIL="$EPISTULA_ROOT_EMAIL"
    export ROOT_PASSWORD="$EPISTULA_ROOT_PASSWORD"

    # If we just prompted/generated a password in this session, request a one-time
    # password reset in the backend on startup so DB matches what the user set.
    # Users who provide env externally can also set RESET_ROOT_PASSWORD_ON_START=1 themselves.
    if [ "$PROMPTED_PASSWORD" -eq 1 ]; then
        export RESET_ROOT_PASSWORD_ON_START="1"
        log_warning "Root password will be updated on backend start (one-time)."
    fi
}

install_docker_buildx() {
    log_info "Installing Docker buildx plugin..."
    
    # Check if docker-buildx-plugin package is available (modern approach)
    if apt-cache show docker-buildx-plugin >/dev/null 2>&1; then
        sudo apt update
        sudo apt install -y docker-buildx-plugin
        log_success "Docker buildx installed via apt"
        return 0
    fi
    
    # Fallback: manual installation from GitHub releases
    log_info "Package not available, installing buildx manually..."
    
    # Extract latest buildx version using jq if available, else fallback to grep/sed
    if command -v jq >/dev/null 2>&1; then
        BUILDX_VERSION=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | jq -r .tag_name | sed 's/^v//')
    else
        BUILDX_VERSION=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
    fi
    # Validate extracted version (must be non-empty and look like a version)
    if [[ -z "$BUILDX_VERSION" || ! "$BUILDX_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        BUILDX_VERSION="0.12.0"  # Fallback version
    fi
    
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64) BUILDX_ARCH="amd64" ;;
        aarch64|arm64) BUILDX_ARCH="arm64" ;;
        armv7l) BUILDX_ARCH="arm-v7" ;;
        *) log_error "Unsupported architecture: $ARCH"; return 1 ;;
    esac
    
    BUILDX_URL="https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-${BUILDX_ARCH}"
    PLUGIN_DIR="${HOME}/.docker/cli-plugins"
    
    mkdir -p "$PLUGIN_DIR"
    curl -sSL "$BUILDX_URL" -o "$PLUGIN_DIR/docker-buildx"
    chmod +x "$PLUGIN_DIR/docker-buildx"
    
    # Verify installation
    if docker buildx version >/dev/null 2>&1; then
        log_success "Docker buildx installed successfully"
        docker buildx create --use --name epistula-builder 2>/dev/null || true
    else
        log_error "Failed to install Docker buildx"
        return 1
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
    --build         Rebuild and start all containers (full rebuild)
    --rebuild-frontend  Rebuild only frontend (faster for UI changes)
    --rebuild-backend   Rebuild only backend (faster for API changes)
    --status        Show container status
    --logs          Show container logs
    --clean         Stop and remove all containers and images
    --help          Show this help message

EXAMPLES:
    $(basename "$0")                    # Start containers (fast, uses cache)
    $(basename "$0") --build            # Full rebuild (slow, for major updates)
    $(basename "$0") --rebuild-frontend # Rebuild frontend only (for UI changes)
    $(basename "$0") --rebuild-backend  # Rebuild backend only (for API changes)
    $(basename "$0") --restart          # Quick restart (fast)
    $(basename "$0") --stop             # Stop containers
    $(basename "$0") --logs             # View logs

EOF
}

#==============================================================================
# Container Management Functions
#==============================================================================

start_with_compose() {
    log_info "Starting containers using Docker Compose..."
    cd "$COMPOSE_DIR"
    
    # Ensure environment variables are set for root user
    ensure_root_env
    
    # Check if images exist
    local need_build=0
    if ! docker images | grep -q "epistula_backend"; then
        need_build=1
    fi
    if ! docker images | grep -q "epistula_frontend"; then
        need_build=1
    fi
    
    if docker compose version >/dev/null 2>&1; then
        if [ "$need_build" -eq 1 ]; then
            log_info "Building images in parallel (first time)..."
            docker compose build --parallel
            docker compose up -d
        else
            log_info "Using existing images (fast startup)..."
            docker compose up -d
        fi
    elif command -v docker-compose >/dev/null 2>&1; then
        if [ "$need_build" -eq 1 ]; then
            log_info "Building images in parallel (first time)..."
            docker-compose build --parallel
            docker-compose up -d
        else
            log_info "Using existing images (fast startup)..."
            docker-compose up -d
        fi
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
        DOCKER_BUILDKIT=1 docker build -t "$BACKEND_IMAGE" ./backend
        
        # Stop and remove old container if exists
        docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
        
        log_info "Starting backend container on port $BACKEND_PORT..."
        docker run -d \
            --name "$BACKEND_CONTAINER" \
            --restart unless-stopped \
            # Pass both legacy (EPISTULA_*) and backend-expected (ROOT_*) vars
            -e EPISTULA_ROOT_EMAIL="$EPISTULA_ROOT_EMAIL" \
            -e EPISTULA_ROOT_NAME="$EPISTULA_ROOT_NAME" \
            -e EPISTULA_ROOT_PASSWORD="$EPISTULA_ROOT_PASSWORD" \
            -e EPISTULA_ROOT_ALLOWED_IPS="$EPISTULA_ROOT_ALLOWED_IPS" \
            -e ROOT_EMAIL="$ROOT_EMAIL" \
            -e ROOT_PASSWORD="$ROOT_PASSWORD" \
            -e RESET_ROOT_PASSWORD_ON_START="${RESET_ROOT_PASSWORD_ON_START:-0}" \
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
        # Build with BACKEND_URL baked at build time for Next.js
        docker build \
            --build-arg BACKEND_URL="http://host.docker.internal:$BACKEND_PORT" \
            -t "$FRONTEND_IMAGE" ./frontend
        
        # Stop and remove old container if exists
        docker rm -f "$FRONTEND_CONTAINER" 2>/dev/null || true
        
        log_info "Starting frontend container on port $FRONTEND_PORT..."
        docker run -d \
            --name "$FRONTEND_CONTAINER" \
            --restart unless-stopped \
            --add-host=host.docker.internal:host-gateway \
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
    if [ -f "$COMPOSE_DIR/docker-compose.yml" ] || \
       [ -f "$COMPOSE_DIR/compose.yml" ] || \
       [ -f "$COMPOSE_DIR/compose.yaml" ]; then
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
    
    # Stop ALL containers with 'epistula' in the name (including manually created ones)
    EPISTULA_CONTAINERS=$(docker ps -a --filter "name=epistula" --format "{{.Names}}" 2>/dev/null || true)
    
    if [ -n "$EPISTULA_CONTAINERS" ]; then
        log_info "Found containers: $(echo $EPISTULA_CONTAINERS | tr '\n' ' ')"
        echo "$EPISTULA_CONTAINERS" | xargs -r docker stop 2>/dev/null || true
        echo "$EPISTULA_CONTAINERS" | xargs -r docker rm 2>/dev/null || true
    fi
    
    # Try Docker Compose cleanup as well
    if [ -f "$COMPOSE_DIR/docker-compose.yml" ] || \
       [ -f "$COMPOSE_DIR/compose.yml" ] || \
       [ -f "$COMPOSE_DIR/compose.yaml" ]; then
        cd "$COMPOSE_DIR"
        if docker compose version >/dev/null 2>&1; then
            docker compose down 2>/dev/null || true
        elif command -v docker-compose >/dev/null 2>&1; then
            docker-compose down 2>/dev/null || true
        fi
    fi
    
    log_success "All containers stopped and removed"
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

    # Check for Docker BuildKit/buildx
    NEEDS_BUILDX=0
    if command -v docker >/dev/null 2>&1; then
        if ! docker buildx version >/dev/null 2>&1; then
            log_warning "Docker buildx (BuildKit) is not available"
            NEEDS_BUILDX=1
        fi
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

    # Install Docker buildx if needed
    if [ "$NEEDS_BUILDX" -eq 1 ]; then
        if [ "$FORCE" -eq 1 ]; then
            log_info "Installing Docker buildx (BuildKit)..."
            install_docker_buildx
        else
            read -p "Install Docker buildx for faster builds? [Y/n]: " -n 1 -r; echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                install_docker_buildx
            else
                log_warning "Continuing without buildx. Builds will use legacy builder (slower, deprecated)."
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
    # Parse for --force flag first
    local FORCE_BUILD=0
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
        --build|build)
            log_info "Forcing rebuild of all containers..."
            stop_containers
            sleep 2
            # Set flag to force rebuild
            FORCE_BUILD=1
            if [ -f "$COMPOSE_DIR/docker-compose.yml" ]; then
                cd "$COMPOSE_DIR"
                ensure_root_env
                if docker compose version >/dev/null 2>&1; then
                    docker compose build --parallel --no-cache
                    docker compose up -d
                elif command -v docker-compose >/dev/null 2>&1; then
                    docker-compose build --parallel --no-cache
                    docker-compose up -d
                fi
                log_success "All containers rebuilt and started"
                show_status
            else
                log_error "docker-compose.yml not found"
                exit 1
            fi
            ;;
        --rebuild-frontend|rebuild-frontend)
            log_info "Rebuilding frontend container..."
            cd "$COMPOSE_DIR"
            if docker compose version >/dev/null 2>&1; then
                docker compose build frontend
                docker compose up -d frontend
            elif command -v docker-compose >/dev/null 2>&1; then
                docker-compose build frontend
                docker-compose up -d frontend
            else
                log_error "Docker Compose not found"
                exit 1
            fi
            log_success "Frontend rebuilt and restarted"
            ;;
        --rebuild-backend|rebuild-backend)
            log_info "Rebuilding backend container..."
            cd "$COMPOSE_DIR"
            if docker compose version >/dev/null 2>&1; then
                docker compose build backend
                docker compose up -d backend
            elif command -v docker-compose >/dev/null 2>&1; then
                docker-compose build backend
                docker-compose up -d backend
            else
                log_error "Docker Compose not found"
                exit 1
            fi
            log_success "Backend rebuilt and restarted"
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
