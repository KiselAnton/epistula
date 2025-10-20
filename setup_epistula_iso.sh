#!/bin/bash
# Epistula Ubuntu ISO Setup Script
# This script creates a custom Ubuntu ISO with Docker, Docker Compose, and Epistula pre-installed
set -e

# Configuration
UBUNTU_VERSION="24.04.3"
ISO_URL="https://releases.ubuntu.com/noble/ubuntu-24.04.3-desktop-amd64.iso"
ISO_NAME="ubuntu-24.04.3-desktop-amd64.iso"
OUTPUT_ISO="epistula-ubuntu.iso"
WORK_DIR="./iso_work"
MOUNT_DIR="${WORK_DIR}/mnt"
EXTRACT_DIR="${WORK_DIR}/extract"
EPISTULA_REPO="https://github.com/KiselAnton/epistula.git"
ISOS_DIR="./isos"  # New: Directory to check for existing ISOs

echo "=== Epistula Ubuntu ISO Builder ==="
echo "This script will create a custom Ubuntu ISO with Epistula pre-installed"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo"
  exit 1
fi

# Check dependencies
echo "[1/7] Checking dependencies..."
DEPS=("wget" "xorriso" "squashfs-tools" "git")
for dep in "${DEPS[@]}"; do
  if ! command -v $dep &> /dev/null; then
    echo "Installing $dep..."
    apt-get update -qq
    apt-get install -y $dep
  fi
done

# Create working directories
echo "[2/7] Creating working directories..."
mkdir -p "${WORK_DIR}" "${MOUNT_DIR}" "${EXTRACT_DIR}"

# Download Ubuntu ISO
# First check if ISO exists in isos folder, then in work_dir, then download
if [ -f "${ISOS_DIR}/${ISO_NAME}" ]; then
  echo "[3/7] Found Ubuntu ISO in isos folder, copying..."
  cp "${ISOS_DIR}/${ISO_NAME}" "${WORK_DIR}/${ISO_NAME}"
elif [ -f "${WORK_DIR}/${ISO_NAME}" ]; then
  echo "[3/7] Ubuntu ISO already in work directory, skipping..."
else
  echo "[3/7] Downloading Ubuntu ${UBUNTU_VERSION} Desktop ISO (recommended for professors)..."
  echo "Tip: Place ISOs in the '${ISOS_DIR}' folder to skip downloading."
  wget -P "${WORK_DIR}" "${ISO_URL}"
fi

# Mount ISO
echo "[4/7] Mounting Ubuntu ISO..."
mount -o loop "${WORK_DIR}/${ISO_NAME}" "${MOUNT_DIR}"

# Extract ISO contents
echo "[5/7] Extracting ISO contents..."
rsync -a --exclude=/casper/filesystem.squashfs "${MOUNT_DIR}/" "${EXTRACT_DIR}/"

# Extract squashfs
echo "[5/7] Extracting filesystem..."
FILESYSTEM_DIR="${WORK_DIR}/squashfs"
mkdir -p "${FILESYSTEM_DIR}"
unsquashfs -f -d "${FILESYSTEM_DIR}" "${MOUNT_DIR}/casper/filesystem.squashfs"

# Unmount original ISO
umount "${MOUNT_DIR}"

# Customize filesystem
echo "[6/7] Customizing filesystem..."

# Mount necessary filesystems for chroot
mount --bind /dev "${FILESYSTEM_DIR}/dev"
mount --bind /proc "${FILESYSTEM_DIR}/proc"
mount --bind /sys "${FILESYSTEM_DIR}/sys"

# Create installation script
cat > "${FILESYSTEM_DIR}/tmp/install.sh" << 'EOF'
#!/bin/bash
set -e

# Update package lists
apt-get update

# Install dependencies
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release

# Add Docker's official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Clone Epistula repository
mkdir -p /opt
cd /opt
git clone https://github.com/KiselAnton/epistula.git

# Create systemd service for Epistula
cat > /etc/systemd/system/epistula.service << 'SERVICE'
[Unit]
Description=Epistula Email Server
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/epistula
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=root

[Install]
WantedBy=multi-user.target
SERVICE

# Enable Epistula service
systemctl enable epistula.service

echo "Installation complete!"
EOF

chmod +x "${FILESYSTEM_DIR}/tmp/install.sh"

# Run installation in chroot
chroot "${FILESYSTEM_DIR}" /tmp/install.sh

# Cleanup
rm "${FILESYSTEM_DIR}/tmp/install.sh"

# Unmount filesystems
umount "${FILESYSTEM_DIR}/dev"
umount "${FILESYSTEM_DIR}/proc"
umount "${FILESYSTEM_DIR}/sys"

# Repack squashfs
echo "[7/7] Creating new ISO..."
rm -f "${EXTRACT_DIR}/casper/filesystem.squashfs"
mksquashfs "${FILESYSTEM_DIR}" "${EXTRACT_DIR}/casper/filesystem.squashfs" -comp xz -b 1M

# Update filesystem.size
printf $(du -sx --block-size=1 "${FILESYSTEM_DIR}" | cut -f1) > "${EXTRACT_DIR}/casper/filesystem.size"

# Create new ISO
cd "${EXTRACT_DIR}"
xorriso -as mkisofs \
  -r -V "Epistula Ubuntu" \
  -o "${WORK_DIR}/../${OUTPUT_ISO}" \
  -J -l -b isolinux/isolinux.bin \
  -c isolinux/boot.cat -no-emul-boot \
  -boot-load-size 4 -boot-info-table \
  -eltorito-alt-boot -e boot/grub/efi.img \
  -no-emul-boot \
  -isohybrid-gpt-basdat \
  .

echo ""
echo "=== ISO Creation Complete ==="
echo "Output: ${OUTPUT_ISO}"
echo "You can now boot from this ISO to install Ubuntu with Epistula pre-configured."
echo ""
