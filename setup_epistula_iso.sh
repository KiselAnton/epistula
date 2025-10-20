#!/usr/bin/env bash
# ISO Customization Script for Epistula
# This script modifies an Ubuntu ISO to include Epistula software
set -euo pipefail
# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
# Essential function definitions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}
error_exit() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}
detect_squashfs() {
    local casper_dir="$1"
    
    # Look for filesystem.squashfs first (standard Ubuntu)
    if [ -f "$casper_dir/filesystem.squashfs" ]; then
        echo "$casper_dir/filesystem.squashfs"
        return 0
    fi
    
    # Look for other common squashfs files
    for squash_file in "$casper_dir"/*.squashfs; do
        if [ -f "$squash_file" ]; then
            echo "$squash_file"
            return 0
        fi
    done
    
    error_exit "No squashfs file found in $casper_dir"
}
check_dependencies() {
    local deps=("unsquashfs" "mksquashfs" "xorriso" "mount" "umount")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error_exit "Required dependency '$dep' not found. Please install squashfs-tools and xorriso."
        fi
    done
}
usage() {
    echo "Usage: $0 [input_iso] [output_iso]"
    echo "  input_iso:  Path to the original Ubuntu ISO file (optional, auto-detects from ./isos)"
    echo "  output_iso: Path for the modified ISO (optional, defaults to epistula_ubuntu.iso)"
    exit 1
}
# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error_exit "This script must be run as root (use sudo)"
fi
# Parse command line arguments
if [ $# -gt 2 ]; then
    usage
fi
if [ $# -eq 0 ]; then
    # Auto-detect most recent ISO in ./isos
    if [ ! -d "./isos" ]; then
        error_exit "./isos directory not found and no ISO specified"
    fi
    
    ORIGINAL_ISO=$(ls -t ./isos/*.iso 2>/dev/null | head -n 1)
    
    if [ -z "$ORIGINAL_ISO" ]; then
        error_exit "No ISO files found in ./isos directory"
    fi
    
    log "${YELLOW}WARNING: No ISO specified, auto-detected: $ORIGINAL_ISO${NC}"
    NEW_ISO="epistula_ubuntu.iso"
elif [ $# -eq 1 ]; then
    ORIGINAL_ISO="$1"
    NEW_ISO="epistula_ubuntu.iso"
else
    ORIGINAL_ISO="$1"
    NEW_ISO="$2"
fi
# Validate input ISO
if [ ! -f "$ORIGINAL_ISO" ]; then
    error_exit "Input ISO file '$ORIGINAL_ISO' does not exist"
fi
# Check dependencies
check_dependencies
# Setup working directories
WORK_DIR="/tmp/epistula_iso_work_$$"
MOUNT_DIR="$WORK_DIR/mount"
EXTRACT_DIR="$WORK_DIR/extract"
CUSTOM_SQUASHFS="$WORK_DIR/custom_squashfs"
# Create working directories
mkdir -p "$MOUNT_DIR" "$EXTRACT_DIR" "$CUSTOM_SQUASHFS"
# Cleanup function
cleanup() {
    log "Performing cleanup..."
    umount "$MOUNT_DIR" 2>/dev/null || true
    umount "$CUSTOM_SQUASHFS/dev" 2>/dev/null || true
    umount "$CUSTOM_SQUASHFS/proc" 2>/dev/null || true
    umount "$CUSTOM_SQUASHFS/sys" 2>/dev/null || true
    rm -rf "$WORK_DIR" 2>/dev/null || true
}
# Set trap for cleanup on exit
trap cleanup EXIT INT TERM
log "Starting ISO customization process..."
log "Input ISO: $ORIGINAL_ISO"
log "Output ISO: $NEW_ISO"
# Mount the original ISO
log "Mounting original ISO..."
mount -o loop "$ORIGINAL_ISO" "$MOUNT_DIR" || error_exit "Failed to mount ISO"
# Extract ISO contents
log "Extracting ISO contents..."
cp -a "$MOUNT_DIR/." "$EXTRACT_DIR/" || error_exit "Failed to extract ISO contents"
# Unmount the original ISO
log "Unmounting original ISO..."
umount "$MOUNT_DIR" || error_exit "Failed to unmount ISO"
log "Detecting squashfs file..."
SQUASHFS_FILE=$(detect_squashfs "$EXTRACT_DIR/casper")
log "Extracting squashfs: $SQUASHFS_FILE"
unsquashfs -d "$CUSTOM_SQUASHFS" "$SQUASHFS_FILE" || error_exit "Failed to extract squashfs"
log "Preparing chroot environment..."
cp /etc/resolv.conf "$CUSTOM_SQUASHFS/etc/resolv.conf" || error_exit "Failed to copy resolv.conf"
log "Creating chroot mount point directories..."
mkdir -p "$CUSTOM_SQUASHFS/dev" "$CUSTOM_SQUASHFS/proc" "$CUSTOM_SQUASHFS/sys"
log "Verifying chroot mount point directories exist..."
if [ ! -d "$CUSTOM_SQUASHFS/dev" ]; then
    error_exit "Failed to create chroot mount point directory: $CUSTOM_SQUASHFS/dev"
fi
if [ ! -d "$CUSTOM_SQUASHFS/proc" ]; then
    error_exit "Failed to create chroot mount point directory: $CUSTOM_SQUASHFS/proc"
fi
if [ ! -d "$CUSTOM_SQUASHFS/sys" ]; then
    error_exit "Failed to create chroot mount point directory: $CUSTOM_SQUASHFS/sys"
fi
log "Mounting chroot filesystems..."
mount --bind /dev "$CUSTOM_SQUASHFS/dev"
mount --bind /proc "$CUSTOM_SQUASHFS/proc"
mount --bind /sys "$CUSTOM_SQUASHFS/sys"
log 'Ensuring $CUSTOM_SQUASHFS/tmp exists for chroot installation script...'
mkdir -p "$CUSTOM_SQUASHFS/tmp" || error_exit "Failed to create chroot tmp directory"
log "Verifying chroot tmp directory exists..."
if [ ! -d "$CUSTOM_SQUASHFS/tmp" ]; then
    error_exit "Failed to create chroot tmp directory: $CUSTOM_SQUASHFS/tmp"
fi
log "Installing epistula in chroot..."
log "Creating chroot installation script..."
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
log "Setting executable permissions on chroot installation script..."
chmod +x "$CUSTOM_SQUASHFS/tmp/install_epistula.sh"
log "Verifying chroot installation script exists and is executable..."
if [ ! -f "$CUSTOM_SQUASHFS/tmp/install_epistula.sh" ]; then
    log "${RED}ERROR: Chroot installation script does not exist at expected location${NC}"
    log "Debugging: Contents of $CUSTOM_SQUASHFS/tmp:"
    ls -la "$CUSTOM_SQUASHFS/tmp" || log "Failed to list directory contents"
    error_exit "Chroot installation script missing: $CUSTOM_SQUASHFS/tmp/install_epistula.sh"
fi
if [ ! -x "$CUSTOM_SQUASHFS/tmp/install_epistula.sh" ]; then
    log "${RED}ERROR: Chroot installation script exists but is not executable${NC}"
    log "Debugging: File permissions:"
    ls -l "$CUSTOM_SQUASHFS/tmp/install_epistula.sh" || log "Failed to show file permissions"
    error_exit "Chroot installation script not executable: $CUSTOM_SQUASHFS/tmp/install_epistula.sh"
fi
log "Chroot installation script verified successfully"
log "Executing chroot installation script..."
chroot "$CUSTOM_SQUASHFS" /tmp/install_epistula.sh || error_exit "Failed to install epistula in chroot"
log "Chroot installation completed successfully"
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
rm -rf "$MOUNT_DIR" "$EXTRACT_DIR" "$CUSTOM_SQUASHFS"
log "SUCCESS: New ISO created at $NEW_ISO"
log "You can now burn this ISO to a USB drive or CD"
