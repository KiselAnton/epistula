#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/KiselAnton/epistula.git"
BRANCH="master"
REPO_DIR="/opt/epistula"
CLONE_DIR="/tmp/epistula_git"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')]" "$@"
}

error_exit() {
  log "ERROR: $1" >&2
  exit 1
}

check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    error_exit "This script must be run as root"
  fi
}

detect_squashfs() {
  local casper_dir="$1"
  local squashfs_file=""

  log "Detecting squashfs file in ${casper_dir}..."

  # Priority 1: minimal.enhanced-secureboot.en.squashfs (desktop ISO with secure boot)
  if [ -f "${casper_dir}/minimal.enhanced-secureboot.en.squashfs" ]; then
    squashfs_file="${casper_dir}/minimal.enhanced-secureboot.en.squashfs"
    log "Found: minimal.enhanced-secureboot.en.squashfs (desktop ISO with secure boot)"

  # Priority 2: minimal.en.squashfs (standard desktop ISO)
  elif [ -f "${casper_dir}/minimal.en.squashfs" ]; then
    squashfs_file="${casper_dir}/minimal.en.squashfs"
    log "Found: minimal.en.squashfs (standard desktop ISO)"

  # Priority 3: any minimal.*.squashfs (other desktop ISO variants)
  elif compgen -G "${casper_dir}/minimal.*.squashfs" > /dev/null; then
    squashfs_file="$(ls -1 ${casper_dir}/minimal.*.squashfs | head -n1)"
    log "Found: $(basename "$squashfs_file") (desktop ISO variant)"

  # Priority 4: filesystem.squashfs (fallback for server ISO)
  elif [ -f "${casper_dir}/filesystem.squashfs" ]; then
    squashfs_file="${casper_dir}/filesystem.squashfs"
    log "Found: filesystem.squashfs (server ISO)"

  else
    error_exit "No suitable squashfs file found in ${casper_dir}"
  fi

  # Verify file is readable and non-empty
  if [ ! -r "$squashfs_file" ]; then
    error_exit "Squashfs file not readable: $squashfs_file"
  fi

  if [ ! -s "$squashfs_file" ]; then
    error_exit "Squashfs file is empty: $squashfs_file"
  fi

  log "Selected squashfs file: $squashfs_file"
  echo "$squashfs_file"
}

check_root

ISO_PATH="$1"
if [ -z "${ISO_PATH:-}" ]; then
  error_exit "Usage: $0 <path_to_ubuntu_iso>"
fi

if [ ! -f "$ISO_PATH" ]; then
  error_exit "ISO file not found: $ISO_PATH"
fi

MOUNT_DIR="/mnt/ubuntu_iso"
FILESYSTEM_DIR="/tmp/ubuntu_filesystem"

log "Mounting ISO: $ISO_PATH"
mkdir -p "$MOUNT_DIR"
mount -o loop "$ISO_PATH" "$MOUNT_DIR" || error_exit "Failed to mount ISO"

trap 'umount "$MOUNT_DIR" 2>/dev/null || true; rmdir "$MOUNT_DIR" 2>/dev/null || true' EXIT

log "Detecting and extracting squashfs filesystem..."
mkdir -p "$FILESYSTEM_DIR"

# Detect the appropriate squashfs file
SQUASHFS_FILE="$(detect_squashfs "${MOUNT_DIR}/casper")"

# Extract the detected squashfs file
unsquashfs -f -d "${FILESYSTEM_DIR}" "${SQUASHFS_FILE}" || error_exit "Failed to extract squashfs"

umount "$MOUNT_DIR"
rmdir "$MOUNT_DIR"

trap '' EXIT

log "Preparing chroot environment..."
mount --bind /dev "${FILESYSTEM_DIR}/dev"
mount --bind /proc "${FILESYSTEM_DIR}/proc"
mount --bind /sys "${FILESYSTEM_DIR}/sys"

trap 'umount "${FILESYSTEM_DIR}/dev" 2>/dev/null || true; umount "${FILESYSTEM_DIR}/proc" 2>/dev/null || true; umount "${FILESYSTEM_DIR}/sys" 2>/dev/null || true; rm -rf "$FILESYSTEM_DIR" 2>/dev/null || true' EXIT

log "Cloning Epistula repository..."
rm -rf "$CLONE_DIR"
mkdir -p "$CLONE_DIR"
git clone --branch "$BRANCH" "$REPO_URL" "$CLONE_DIR" || error_exit "Failed to clone repository"

log "Copying repository into chroot..."
mkdir -p "${FILESYSTEM_DIR}${REPO_DIR}"
cp -r "${CLONE_DIR}"/* "${FILESYSTEM_DIR}${REPO_DIR}/"
rm -rf "$CLONE_DIR"

log "Installing Epistula in chroot..."
cat > "${FILESYSTEM_DIR}/tmp/install_epistula.sh" << 'EOFINSTALL'
#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y python3 python3-pip docker.io docker-compose

systemctl enable docker

cd /opt/epistula/epistula
docker-compose build

cat > /etc/systemd/system/epistula.service << 'EOFSERVICE'
[Unit]
Description=Epistula Email Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/epistula/epistula
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down

[Install]
WantedBy=multi-user.target
EOFSERVICE

systemctl enable epistula.service

echo "Epistula installation complete"
EOFINSTALL

chmod +x "${FILESYSTEM_DIR}/tmp/install_epistula.sh"
chroot "$FILESYSTEM_DIR" /tmp/install_epistula.sh || error_exit "Failed to install Epistula"

log "Cleaning up..."
rm "${FILESYSTEM_DIR}/tmp/install_epistula.sh"

umount "${FILESYSTEM_DIR}/dev"
umount "${FILESYSTEM_DIR}/proc"
umount "${FILESYSTEM_DIR}/sys"

trap '' EXIT

log "Creating new squashfs..."
NEW_SQUASHFS="/tmp/new_filesystem.squashfs"
mksquashfs "$FILESYSTEM_DIR" "$NEW_SQUASHFS" -noappend -comp xz || error_exit "Failed to create new squashfs"

log "Cleaning up filesystem directory..."
rm -rf "$FILESYSTEM_DIR"

log "Setup complete. New squashfs: $NEW_SQUASHFS"
log "You can now replace the original squashfs in your ISO with this file."
