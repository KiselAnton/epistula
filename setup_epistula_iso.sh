#!/usr/bin/env bash
log "Detecting squashfs file..."
SQUASHFS_FILE=$(detect_squashfs "$MOUNT_DIR/casper")

log "Extracting squashfs: $SQUASHFS_FILE"
unsquashfs -d "$CUSTOM_SQUASHFS" "$SQUASHFS_FILE" || error_exit "Failed to extract squashfs"

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
rm -rf "$MOUNT_DIR" "$EXTRACT_DIR" "$CUSTOM_SQUASHFS"

log "SUCCESS: New ISO created at $NEW_ISO"
log "You can now burn this ISO to a USB drive or CD"
