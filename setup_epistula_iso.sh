#!/usr/bin/env bash
#
# setup_epistula_iso.sh - Epistula ISO Setup Script
#
# A modular setup script for Epistula custom ISO environment.
#
# Usage: ./setup_epistula_iso.sh [OPTIONS]
#
# Author: KiselAnton
# License: MIT

# Use bash-specific options if running in bash, otherwise fallback to POSIX
if [ -n "${BASH_VERSION:-}" ]; then
  set -euo pipefail
else
  set -eu
fi

#==============================================================================
# CONSTANTS
#==============================================================================

readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_VERSION="0.3.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ISO_DIR="${SCRIPT_DIR}/isos"
readonly UBUNTU_MIRROR="https://releases.ubuntu.com"
readonly UBUNTU_VERSION="24.04"
readonly WORK_DIR="${SCRIPT_DIR}/work"
readonly OUTPUT_ISO_NAME="ubuntu-${UBUNTU_VERSION}.3-epistula-server-amd64.iso"

#==============================================================================
# GLOBAL VARIABLES
#==============================================================================

VERBOSE="false"
DRY_RUN="false"
CONFIG_FILE=""
ISO_PATH=""
# Default system settings (can be overridden via CLI)
LOCALE="en_DK.UTF-8"
KEYBOARD_LAYOUT="us"
TIMEZONE="Etc/UTC"

#==============================================================================
# FUNCTIONS
#==============================================================================

# Display usage information
show_usage() {
    cat << EOF
Usage: ${SCRIPT_NAME} [OPTIONS]

Epistula ISO Setup Script - Initial stub for modular development.

OPTIONS:
    -h, --help          Show this help message and exit
    -v, --version       Show version information and exit
    -d, --dry-run       Run in dry-run mode (show what would be done)
    --verbose           Enable verbose output
    --config FILE       Use custom configuration file
    --locale LOCALE     Set installer locale (default: ${LOCALE})
    --keyboard LAYOUT   Set keyboard layout (default: ${KEYBOARD_LAYOUT})
    --timezone ZONE     Set timezone (default: ${TIMEZONE})

EXAMPLES:
    ${SCRIPT_NAME} --help
    ${SCRIPT_NAME} --dry-run
    ${SCRIPT_NAME} --verbose
    ${SCRIPT_NAME} --config /path/to/config.conf

For more information, visit: https://github.com/KiselAnton/epistula
EOF
}

# Display version information
show_version() {
    echo "${SCRIPT_NAME} version ${SCRIPT_VERSION}"
}

# Log functions for better output management
log_info() {
    echo "[INFO] $*"
}

log_error() {
    echo "[ERROR] $*" >&2
}

log_verbose() {
    if [ "${VERBOSE}" = "true" ]; then
        echo "[VERBOSE] $*"
    fi
}

# Parse command-line arguments
parse_arguments() {
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--version)
                show_version
                exit 0
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                log_info "Dry-run mode enabled"
                shift
                ;;
            --verbose)
                VERBOSE="true"
                log_verbose "Verbose mode enabled"
                shift
                ;;
            --config)
                if [ -n "${2:-}" ]; then
                    CONFIG_FILE="$2"
                    log_info "Using config file: ${CONFIG_FILE}"
                    shift 2
                else
                    log_error "--config requires a file path"
                    exit 1
                fi
                ;;
            --locale)
                if [ -n "${2:-}" ]; then
                    LOCALE="$2"
                    log_info "Locale set to: ${LOCALE}"
                    shift 2
                else
                    log_error "--locale requires a value (e.g., en_US.UTF-8)"
                    exit 1
                fi
                ;;
            --keyboard)
                if [ -n "${2:-}" ]; then
                    KEYBOARD_LAYOUT="$2"
                    log_info "Keyboard layout set to: ${KEYBOARD_LAYOUT}"
                    shift 2
                else
                    log_error "--keyboard requires a layout (e.g., us)"
                    exit 1
                fi
                ;;
            --timezone)
                if [ -n "${2:-}" ]; then
                    TIMEZONE="$2"
                    log_info "Timezone set to: ${TIMEZONE}"
                    shift 2
                else
                    log_error "--timezone requires a value (e.g., Europe/Berlin or Etc/UTC)"
                    exit 1
                fi
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Install missing packages with apt-get
install_missing_packages() {
    local packages=("$@")
    
    log_info "Installing missing packages: ${packages[*]}"
    
    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[DRY-RUN] Would run: sudo apt-get update && sudo apt-get install -y ${packages[*]}"
        return 0
    fi
    
    # Update package lists
    log_verbose "Running apt-get update..."
    if ! sudo apt-get update; then
        log_error "Failed to update package lists"
        return 1
    fi
    
    # Install packages
    log_verbose "Installing packages: ${packages[*]}"
    if ! sudo apt-get install -y "${packages[@]}"; then
        log_error "Failed to install packages"
        return 1
    fi
    
    log_info "Successfully installed all missing packages"
    return 0
}

# Check system prerequisites
check_prerequisites() {
    log_info "Checking system prerequisites..."
    log_verbose "Checking for required commands"
    
    # Prefer xorriso for both extraction and ISO building; mkisofs is a fallback
    local required_commands=("wget" "xorriso" "mount" "umount" "openssl")
    local missing_commands=()
    local packages_to_install=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "${cmd}" >/dev/null 2>&1; then
            missing_commands+=("${cmd}")
        fi
    done
    
    if [ ${#missing_commands[@]} -gt 0 ]; then
        log_error "Missing required commands: ${missing_commands[*]}"
        
        # Map commands to package names
        for cmd in "${missing_commands[@]}"; do
            case "${cmd}" in
                wget)
                    packages_to_install+=("wget")
                    ;;
                xorriso)
                    packages_to_install+=("xorriso")
                    ;;
                mount|umount)
                    # These are typically in util-linux, which is usually pre-installed
                    # but we'll add it just in case
                    if [[ ! " ${packages_to_install[*]} " =~ " util-linux " ]]; then
                        packages_to_install+=("util-linux")
                    fi
                    ;;
                openssl)
                    packages_to_install+=("openssl")
                    ;;
            esac
        done
        
        # Ask user for approval to install
        echo ""
        echo "The following packages need to be installed: ${packages_to_install[*]}"
        echo -n "Do you want to install them now? [Y/n]: "
        read -r response
        
        # Default to yes if empty response
        response=${response:-Y}
        
        if [[ "${response}" =~ ^[Yy]$ ]]; then
            log_info "User approved package installation"
            if install_missing_packages "${packages_to_install[@]}"; then
                log_info "All prerequisites satisfied after installation"
                return 0
            else
                log_error "Failed to install required packages"
                return 1
            fi
        else
            log_info "User declined package installation"
            log_error "Please install the required packages manually"
            return 1
        fi
    fi
    
    log_info "All prerequisites satisfied"
    return 0
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    log_verbose "ISO_DIR: ${ISO_DIR}"
    log_verbose "WORK_DIR: ${WORK_DIR}"
    
    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[DRY-RUN] Would create directories: ${ISO_DIR}, ${WORK_DIR}"
    else
        mkdir -p "${ISO_DIR}" "${WORK_DIR}"
        log_info "Directories created successfully"
    fi
}

# Download Ubuntu ISO if needed
download_iso() {
    log_info "Checking for Ubuntu ${UBUNTU_VERSION} ISO..."
    
    # Check for existing ISOs in preferred order (Server ISO for autoinstall support)
    local iso_patterns=(
        "ubuntu-${UBUNTU_VERSION}.3-live-server-amd64.iso"
        "ubuntu-${UBUNTU_VERSION}.2-live-server-amd64.iso"
        "ubuntu-${UBUNTU_VERSION}.1-live-server-amd64.iso"
        "ubuntu-${UBUNTU_VERSION}-live-server-amd64.iso"
    )
    
    # Search for existing ISO files
    for pattern in "${iso_patterns[@]}"; do
        local candidate="${ISO_DIR}/${pattern}"
        if [ -f "${candidate}" ]; then
            ISO_PATH="${candidate}"
            log_info "Found existing ISO: ${ISO_PATH}"
            return 0
        fi
    done
    
    # No ISO found, need to download
    log_info "No ISO found in ${ISO_DIR}"
    
    # Determine the latest point release to download (Server ISO for autoinstall support)
    local iso_filename="ubuntu-${UBUNTU_VERSION}.3-live-server-amd64.iso"
    local iso_url="${UBUNTU_MIRROR}/${UBUNTU_VERSION}/ubuntu-${UBUNTU_VERSION}.3-live-server-amd64.iso"
    ISO_PATH="${ISO_DIR}/${iso_filename}"
    
    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[DRY-RUN] Would download: ${iso_filename}"
        log_info "[DRY-RUN] From: ${iso_url}"
        log_info "[DRY-RUN] To: ${ISO_PATH}"
    else
        log_info "Downloading ${iso_filename}..."
        log_info "From: ${iso_url}"
        log_info "To: ${ISO_PATH}"
        log_info "This may take a while (approximately 5-6 GB)..."
        
        # Use wget with progress bar and resume capability
        if ! wget -c -O "${ISO_PATH}" "${iso_url}"; then
            log_error "Failed to download ISO from ${iso_url}"
            
            # Try fallback to .2 or .1 release
            log_info "Trying alternative download URLs..."
            local fallback_patterns=("2" "1" "")
            
            for ver in "${fallback_patterns[@]}"; do
                if [ -n "${ver}" ]; then
                    iso_filename="ubuntu-${UBUNTU_VERSION}.${ver}-live-server-amd64.iso"
                    iso_url="${UBUNTU_MIRROR}/${UBUNTU_VERSION}/ubuntu-${UBUNTU_VERSION}.${ver}-live-server-amd64.iso"
                else
                    iso_filename="ubuntu-${UBUNTU_VERSION}-live-server-amd64.iso"
                    iso_url="${UBUNTU_MIRROR}/${UBUNTU_VERSION}/ubuntu-${UBUNTU_VERSION}-live-server-amd64.iso"
                fi
                
                ISO_PATH="${ISO_DIR}/${iso_filename}"
                log_info "Trying: ${iso_url}"
                
                if wget -c -O "${ISO_PATH}" "${iso_url}"; then
                    log_info "Successfully downloaded ${iso_filename}"
                    return 0
                fi
            done
            
            log_error "All download attempts failed"
            return 1
        fi
        
        log_info "Successfully downloaded ${iso_filename}"
    fi
}

############################################################
# ISO extraction and customization helpers
############################################################

# Extract ISO contents to work directory
extract_iso() {
  log_info "Extracting ISO contents to work directory..."
  local extract_dir="${WORK_DIR}/iso"
  
  # Clean any existing extraction to ensure fresh content
  if [ -d "$extract_dir" ]; then
    log_verbose "Removing existing extraction directory"
    rm -rf "$extract_dir"
  fi
  
  mkdir -p "$extract_dir"
  
  if [ "$DRY_RUN" = "true" ]; then
    log_info "[DRY-RUN] Would extract ${ISO_PATH} to ${extract_dir}"
    return 0
  fi
  
  if command -v 7z >/dev/null 2>&1; then
    log_info "Using 7z for ISO extraction..."
    7z x "$ISO_PATH" -o"$extract_dir"
  elif command -v xorriso >/dev/null 2>&1; then
    log_info "Using xorriso for ISO extraction..."
    xorriso -osirrox on -indev "$ISO_PATH" -extract / "$extract_dir"
  else
    log_error "No extraction tool available (need 7z or xorriso)"
    exit 1
  fi
  
  log_info "ISO extraction complete: $extract_dir"
}

stage_repo_into_iso() {
    # Copy the current repository into the ISO so it is available at install time
    local extract_dir="${WORK_DIR}/iso"
    local dest_dir="$extract_dir/epistula-repo"
    log_info "Staging current repo into ISO at /epistula-repo ..."

    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY-RUN] Would copy contents of ${SCRIPT_DIR} into ${dest_dir}, excluding isos/, work/, .git/ and build artifacts"
        return 0
    fi

    mkdir -p "$dest_dir"
    # Use tar to copy while excluding work artifacts and VCS data
    (
        cd "$SCRIPT_DIR"
        tar --exclude='./work' \
                --exclude='./isos' \
                --exclude='./iso_work' \
                --exclude='./.git' \
                --exclude='./.vscode' \
                -cf - .
    ) | (
        cd "$dest_dir"
        tar -xf -
    )

    log_info "Repository staged into ISO"
}

create_nocloud_seed() {
    # Create NoCloud seed for autoinstall to configure the installed system
    local extract_dir="${WORK_DIR}/iso"
    local seed_dir="$extract_dir/nocloud"
    local epistula_dir="$seed_dir/epistula"
  
    log_info "Creating NoCloud autoinstall seed..."
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY-RUN] Would create $seed_dir with user-data/meta-data and epistula assets"
        return 0
    fi
  
    mkdir -p "$epistula_dir"
    echo "instance-id: epistula-iso" > "$seed_dir/meta-data"
    echo "local-hostname: epistula" >> "$seed_dir/meta-data"

    # Generate a SHA-512 hashed password for 'epistula'
    local hashed_pw
    if command -v openssl >/dev/null 2>&1; then
        hashed_pw=$(openssl passwd -6 epistula)
    else
        log_error "openssl not found; cannot generate password hash"
        log_error "Please install openssl or provide a precomputed hash"
        exit 1
    fi

    # Write user-data for autoinstall
    cat >"$seed_dir/user-data" <<EOF
#cloud-config
autoinstall:
    version: 1
    locale: ${LOCALE}
    keyboard:
        layout: ${KEYBOARD_LAYOUT}
    timezone: ${TIMEZONE}
    identity:
        hostname: epistula
        username: Administrator
        password: ${hashed_pw}
    updates: all
    ssh:
        install-server: true
        allow-pw: true
    packages:
        - curl
        - git
        - ca-certificates
        - ubuntu-desktop-minimal
        - gdm3
    storage:
        layout:
            name: lvm
    late-commands:
        - curtin in-target --target=/target -- sh -c 'systemctl set-default graphical.target'
        - curtin in-target --target=/target -- sh -c 'systemctl enable gdm3'
        - cp -a /cdrom/nocloud/epistula /target/opt/epistula
        - curtin in-target --target=/target -- sh -c 'chmod +x /opt/epistula/setup.sh || true'
        - cp /cdrom/nocloud/epistula/epistula-setup.service /target/etc/systemd/system/epistula-setup.service
        - curtin in-target --target=/target -- sh -c 'systemctl enable epistula-setup.service'
        - curtin in-target --target=/target -- sh -c "locale-gen ${LOCALE} && update-locale LANG=${LOCALE} LC_TIME=${LOCALE}"
        - '[ ! -d /cdrom/epistula-repo ] || cp -a /cdrom/epistula-repo /target/opt/epistula/src'
        - curtin in-target --target=/target -- sh -c "ping -c1 -W2 1.1.1.1 >/dev/null 2>&1 && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y dist-upgrade"
        - curtin in-target --target=/target -- sh -c 'chmod +x /opt/epistula/ensure-containers.sh'
        - cp /cdrom/nocloud/epistula/epistula-containers.service /target/etc/systemd/system/epistula-containers.service
        - curtin in-target --target=/target -- sh -c 'systemctl enable epistula-containers.service'
EOF

    # First-boot setup script (runs on installed system) - initial updates and housekeeping
    cat >"$epistula_dir/setup.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

log() { echo "[epistula-setup] $*"; }

log "Starting Epistula first-boot setup"

if ping -c1 -W2 1.1.1.1 >/dev/null 2>&1; then
    log "Internet reachable. Installing Docker..."
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-buildx docker-compose
    log "Adding Administrator to docker group..."
    usermod -aG docker Administrator
    log "Enabling and starting Docker..."
    systemctl enable docker
    systemctl start docker
    # Start Epistula containers service now that Docker is available
    log "Starting Epistula containers service..."
    systemctl restart epistula-containers.service || true
else
    log "Internet not reachable. Skipping Docker install."
fi

# If internet is reachable, refresh OS packages once more
if ping -c1 -W2 1.1.1.1 >/dev/null 2>&1; then
    log "Updating packages..."
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade
else
    log "Internet not reachable. Skipping package update."
fi

# Disable service after success so it does not run again
systemctl disable epistula-setup.service
log "Epistula setup complete"
EOF
    chmod +x "$epistula_dir/setup.sh"

    # Continuous containers ensure script (runs each boot)
    cat >"$epistula_dir/ensure-containers.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

log() { echo "[epistula-containers] $*"; }

log "Ensuring Epistula containers are up"

# Start docker
systemctl start docker || true

APP_DIR="/opt/epistula/src"
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  if [ -f docker-compose.yml ] || [ -f compose.yml ] || [ -f compose.yaml ]; then
    log "docker compose up -d"
    docker compose up -d || {
      log "docker compose failed; attempting docker-compose";
      command -v docker-compose >/dev/null 2>&1 && docker-compose up -d || true;
    }
  else
    # Fallback builds
    if [ -f backend/Dockerfile ]; then
      log "Building backend image..."
      docker build -t epistula-backend ./backend || true
      log "Running backend container..."
      docker rm -f epistula-backend || true
      docker run -d --name epistula-backend --restart unless-stopped epistula-backend || true
    fi
    if [ -f frontend/Dockerfile ]; then
      log "Building frontend image..."
      docker build -t epistula-frontend ./frontend || true
      log "Running frontend container..."
      docker rm -f epistula-frontend || true
      docker run -d --name epistula-frontend --restart unless-stopped -p 80:80 epistula-frontend || true
    fi
  fi
else
  log "App directory not found: $APP_DIR"
fi
EOF
    chmod +x "$epistula_dir/ensure-containers.sh"

    # Systemd unit to run setup.sh once at first boot
    cat >"$epistula_dir/epistula-setup.service" <<'EOF'
[Unit]
Description=Epistula first-boot setup
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/epistula/setup.sh
RemainAfterExit=true

[Install]
WantedBy=multi-user.target
EOF

    # Systemd unit to ensure containers are started on every boot
    cat >"$epistula_dir/epistula-containers.service" <<'EOF'
[Unit]
Description=Ensure Epistula containers are started
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/epistula/ensure-containers.sh
RemainAfterExit=true

[Install]
WantedBy=multi-user.target
EOF

    log_info "NoCloud seed and Epistula assets created"
}

patch_boot_configs() {
    # Add autoinstall kernel parameters so installer consumes NoCloud seed from /cdrom/nocloud
    local extract_dir="${WORK_DIR}/iso"
    local seed_param="autoinstall ds=nocloud\\\\;s=/cdrom/nocloud/"

    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY-RUN] Would patch boot configs with: $seed_param"
        return 0
    fi

    # Common GRUB config paths for Ubuntu ISO
    local grub_cfgs=(
        "$extract_dir/boot/grub/grub.cfg"
        "$extract_dir/boot/grub/loopback.cfg"
    )
    for cfg in "${grub_cfgs[@]}"; do
        if [ -f "$cfg" ]; then
            log_info "Patching GRUB config: $cfg"
            # Replace the entire linux/linuxefi line to inject autoinstall params right after vmlinuz
            sed -i -E "s|(linux[[:space:]]+/casper/vmlinuz[[:space:]]+)|\1${seed_param} |" "$cfg" || true
            sed -i -E "s|(linuxefi[[:space:]]+/casper/vmlinuz[[:space:]]+)|\1${seed_param} |" "$cfg" || true
        fi
    done

    # ISOLINUX/SYSLINUX config for BIOS boots
    local syslinux_cfgs=(
        "$extract_dir/isolinux/txt.cfg"
        "$extract_dir/isolinux/isolinux.cfg"
    )
    for cfg in "${syslinux_cfgs[@]}"; do
        if [ -f "$cfg" ]; then
            log_info "Patching ISOLINUX config: $cfg"
            sed -i -E "s|(append[[:space:]]+)|\1${seed_param} |" "$cfg" || true
        fi
    done

    log_info "Boot configs patched for autoinstall"
}

repack_iso() {
    local extract_dir="${WORK_DIR}/iso"
    local output_iso="${ISO_DIR}/${OUTPUT_ISO_NAME}"
    log_info "Repacking customized ISO -> ${output_iso}"

    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY-RUN] Would rebuild ISO at ${output_iso} by replaying boot data and mapping: /nocloud and patched boot configs"
        return 0
    fi

    if ! command -v xorriso >/dev/null 2>&1; then
        log_error "xorriso is required to rebuild a bootable ISO reliably"
        return 1
    fi

    # Ensure the output file does not already exist with non-zero data
    if [ -f "$output_iso" ]; then
        log_verbose "Removing existing output ISO to satisfy xorriso overwrite rules"
        rm -f "$output_iso" || true
    fi

    # Get original Volume ID to avoid ISO9660 warnings and keep compatibility
    local orig_volid
    orig_volid=$(xorriso -indev "$ISO_PATH" -pvd_info 2>/dev/null | sed -n 's/^Volume id: //p' | head -n1 || true)

    # Build xorriso command incrementally: replay boot data, then map only changed paths
    local cmd=(xorriso -indev "$ISO_PATH" -outdev "$output_iso" -boot_image any replay)

    # Preserve volume id if we were able to read it
    if [ -n "$orig_volid" ]; then
        cmd+=( -volid "$orig_volid" )
    fi

    # Always add the NoCloud seed directory
    if [ -d "$extract_dir/nocloud" ]; then
        cmd+=( -map "$extract_dir/nocloud" /nocloud )
    else
        log_error "Expected NoCloud directory not found: $extract_dir/nocloud"
        return 1
    fi

    # Add the repo payload if present
    if [ -d "$extract_dir/epistula-repo" ]; then
        cmd+=( -map "$extract_dir/epistula-repo" /epistula-repo )
    fi

    # If we patched boot configs, map them explicitly so originals get replaced
    local rel
    for rel in \
        /boot/grub/grub.cfg \
        /boot/grub/loopback.cfg \
        /isolinux/txt.cfg \
        /isolinux/isolinux.cfg; do
        if [ -f "$extract_dir$rel" ]; then
            cmd+=( -map "$extract_dir$rel" "$rel" )
        fi
    done

    # Execute the xorriso command
    if "${cmd[@]}"; then
        log_info "Custom ISO created: ${output_iso}"
    else
        log_error "xorriso failed while creating the ISO"
        return 1
    fi
}

# Main execution function
main() {
    log_info "Starting Epistula ISO Setup"
    log_info "Version: ${SCRIPT_VERSION}"
    
    # Parse command-line arguments
    parse_arguments "$@"
    
    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    
    # Setup directories
    setup_directories
    
    # Download ISO if needed
    download_iso
    
        # Extract ISO contents
        extract_iso

        # Create autoinstall seed and assets
        create_nocloud_seed

        # Stage current repository into ISO for first-boot deployment
        stage_repo_into_iso

        # Patch boot configs to enable autoinstall from NoCloud seed
        patch_boot_configs

        # Repack ISO
        repack_iso
    
    log_info "Epistula ISO Setup completed successfully"
}

#==============================================================================
# MAIN EXECUTION
#==============================================================================

# Call main function with all arguments
main "$@"
