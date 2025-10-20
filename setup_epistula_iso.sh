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
  local casper_dir="${1:-}"
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
  else
    for f in "${casper_dir}"/minimal.*.squashfs; do
      [ -e "$f" ] || continue
      squashfs_file="$f"
      log "Found: $(basename "$squashfs_file") (desktop ISO variant)"
      break
    done
  fi
  
  # Priority 4: filesystem.squashfs (fallback for server ISO)
  if [ -z "${squashfs_file}" ] && [ -f "${casper_dir}/filesystem.squashfs" ]; then
    squashfs_file="${casper_dir}/filesystem.squashfs"
    log "Found: filesystem.squashfs (server ISO)"
  fi
  
  # Check if we found anything
  if [ -z "${squashfs_file}" ]; then
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
  error_exit "Usage: $0 <path-to-ubuntu-iso>"
fi

if [ ! -f "$ISO_PATH" ]; then
  error_exit "ISO file not found: $ISO_PATH"
fi

MOUNT_DIR="/mnt/ubuntu_iso"
EXTRACT_DIR="/tmp/ubuntu_extract"
SQUASHFS_MOUNT="/mnt/squashfs"
CUSTOM_SQUASHFS="/tmp/custom_squashfs"
NEW_ISO="/tmp/epistula_ubuntu.iso"

log "Cleaning up any previous mounts and directories..."
umount "$MOUNT_DIR" 2>/dev/null || true
umount "$SQUASHFS_MOUNT" 2>/dev/null || true
rm -rf "$MOUNT_DIR" "$EXTRACT_DIR" "$SQUASHFS_MOUNT" "$CUSTOM_SQUASHFS" "$NEW_ISO"

log "Creating mount points and extraction directories..."
mkdir -p "$MOUNT_DIR" "$EXTRACT_DIR" "$SQUASHFS_MOUNT" "$CUSTOM_SQUASHFS"

log "Mounting ISO..."
mount -o loop "$ISO_PATH" "$MOUNT_DIR" || error_exit "Failed to mount ISO"

log "Copying ISO contents to extraction directory..."
rsync -a --exclude=casper/filesystem.squashfs --exclude=casper/minimal.*.squashfs "$MOUNT_DIR/" "$EXTRACT_DIR/" || error_exit "Failed to copy ISO contents"

log "Detecting squashfs file..."
SQUASHFS_FILE=$(detect_squashfs "$MOUNT_DIR/casper")

log "Mounting squashfs: $SQUASHFS_FILE"
mount -o loop "$SQUASHFS_FILE" "$SQUASHFS_MOUNT" || error_exit "Failed to mount squashfs"

log "Copying squashfs contents..."
rsync -a "$SQUASHFS_MOUNT/" "$CUSTOM_SQUASHFS/" || error_exit "Failed to copy squashfs contents"

log "Unmounting squashfs..."
umount "$SQUASHFS_MOUNT" || error_exit "Failed to unmount squashfs"

log "Preparing chroot environment..."
cp /etc/resolv.conf "$CUSTOM_SQUASHFS/etc/resolv.conf" || error_exit "Failed to copy resolv.conf"

log "Cloning epistula repository..."
mount --bind /dev "$CUSTOM_SQUASHFS/dev"
mount --bind /proc "$CUSTOM_SQUASHFS/proc"
mount --bind /sys "$CUSTOM_SQUASHFS/sys"

log "Installing epistula in chroot..."
cat << 'CHROOT_SCRIPT' > "$CUSTOM_SQUASHFS/tmp/install_epistula.sh"
#!/bin/bash
set -euo pipefail

apt-get update
apt-get install -y git

if [ -d "/opt/epistula" ]; then
  rm -rf /opt/epistula
fi

git clone https://github.com/KiselAnton/epistula.git /opt/epistula
cd /opt/epistula

if [ -f "setup.sh" ]; then
  bash setup.sh
else
  echo "WARNING: setup.sh not found, skipping setup"
fi

CHROOT_SCRIPT

chmod +x "$CUSTOM_SQUASHFS/tmp/install_epistula.sh"
chroot "$CUSTOM_SQUASHFS" /tmp/install_epistula.sh || error_exit "Failed to install epistula in chroot"

log "Cleaning up chroot..."
rm -f "$CUSTOM_SQUASHFS/tmp/install_epistula.sh"
rm -f "$CUSTOM_SQUASHFS/etc/resolv.conf"

umount "$CUSTOM_SQUASHFS/dev" || true
umount "$CUSTOM_SQUASHFS/proc" || true
umount "$CUSTOM_SQUASHFS/sys" || true

log "Creating new squashfs..."
NEW_SQUASHFS="$EXTRACT_DIR/casper/$(basename "$SQUASHFS_FILE")"
mksquashfs "$CUSTOM_SQUASHFS" "$NEW_SQUASHFS" -comp xz -b 1M || error_exit "Failed to create new squashfs"

log "Updating manifest and size files..."
chroot "$CUSTOM_SQUASHFS" dpkg-query -W --showformat='${Package} ${Version}\n' > "$EXTRACT_DIR/casper/filesystem.manifest" 2>/dev/null || true
printf $(du -sx --block-size=1 "$CUSTOM_SQUASHFS" | cut -f1) > "$EXTRACT_DIR/casper/filesystem.size"

log "Calculating MD5 checksums..."
cd "$EXTRACT_DIR"
find . -type f -print0 | xargs -0 md5sum | grep -v "./md5sum.txt" > md5sum.txt

log "Creating new ISO..."
xorriso -as mkisofs \
  -r -V "Epistula Ubuntu" \
  -o "$NEW_ISO" \
  -J -l -b isolinux/isolinux.bin \
  -c isolinux/boot.cat \
  -no-emul-boot \
  -boot-load-size 4 \
  -boot-info-table \
  -eltorito-alt-boot \
  -e boot/grub/efi.img \
  -no-emul-boot \
  -isohybrid-gpt-basdat \
  "$EXTRACT_DIR" || error_exit "Failed to create ISO"

log "Cleaning up..."
umount "$MOUNT_DIR" || true
rm -rf "$MOUNT_DIR" "$EXTRACT_DIR" "$SQUASHFS_MOUNT" "$CUSTOM_SQUASHFS"

log "SUCCESS: New ISO created at $NEW_ISO"
log "You can now burn this ISO to a USB drive or CD"
