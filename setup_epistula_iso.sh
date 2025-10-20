#!/usr/bin/env bash
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
log "Ensuring $CUSTOM_SQUASHFS/bin exists for bash interpreter..."
mkdir -p "$CUSTOM_SQUASHFS/bin" || error_exit "Failed to create chroot bin directory"
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
