#!/usr/bin/env python3
"""
Epistula ISO Builder - Creates a custom Ubuntu ISO with Epistula preinstalled
Usage:
    sudo python3 setup_epistula_iso.py <input_iso> [output_iso]
    
Example:
    sudo python3 setup_epistula_iso.py ubuntu-24.04-desktop-amd64.iso epistula-ubuntu.iso
"""
import os
import sys
import subprocess
import shutil
import tempfile
from pathlib import Path

class Colors:
    """ANSI color codes for terminal output"""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'  # No Color

def log(message, color=None):
    """Print a colored log message"""
    if color:
        print(f"{color}{message}{Colors.NC}")
    else:
        print(message)

def warn(message):
    """Print a warning to stderr in yellow"""
    sys.stderr.write(f"{Colors.YELLOW}WARNING: {message}{Colors.NC}\n")

def error_exit(message):
    """Print error message and exit"""
    log(f"ERROR: {message}", Colors.RED)
    sys.exit(1)

def run_command(cmd, check=True, shell=False, cwd=None):
    """Run a command and handle errors"""
    try:
        if shell:
            result = subprocess.run(cmd, shell=True, check=check, cwd=cwd,
                                  capture_output=True, text=True)
        else:
            result = subprocess.run(cmd, check=check, cwd=cwd,
                                  capture_output=True, text=True)
        return result
    except subprocess.CalledProcessError as e:
        log(f"Command failed: {' '.join(cmd) if isinstance(cmd, list) else cmd}", Colors.RED)
        if e.stderr:
            log(f"Error output: {e.stderr}", Colors.RED)
        raise

def check_root():
    """Check if script is running as root"""
    if os.geteuid() != 0:
        error_exit("This script must be run as root (use sudo)")

def check_dependencies():
    """Check if required tools are installed"""
    log("Checking dependencies...", Colors.YELLOW)
    required_tools = ['xorriso', 'unsquashfs', 'mksquashfs']
    missing_tools = []
    
    for tool in required_tools:
        result = subprocess.run(['which', tool], capture_output=True)
        if result.returncode != 0:
            missing_tools.append(tool)
    
    if missing_tools:
        log("Missing required tools. Installing...", Colors.YELLOW)
        try:
            run_command(['apt-get', 'update'])
            run_command(['apt-get', 'install', '-y', 'xorriso', 'squashfs-tools'])
        except subprocess.CalledProcessError:
            error_exit(f"Failed to install required tools: {', '.join(missing_tools)}")
    
    log("All dependencies satisfied", Colors.GREEN)

def mount_iso(iso_path, mount_point):
    """Mount an ISO file"""
    log(f"Mounting ISO: {iso_path}", Colors.YELLOW)
    os.makedirs(mount_point, exist_ok=True)
    try:
        run_command(['mount', '-o', 'loop', str(iso_path), mount_point])
    except subprocess.CalledProcessError:
        error_exit(f"Failed to mount ISO: {iso_path}")

def extract_iso(mount_point, extract_dir):
    """Extract ISO contents"""
    log("Extracting ISO contents...", Colors.YELLOW)
    os.makedirs(extract_dir, exist_ok=True)
    try:
        run_command(f"rsync -a {mount_point}/ {extract_dir}/", shell=True)
    except subprocess.CalledProcessError:
        error_exit("Failed to extract ISO contents")

def extract_squashfs(squashfs_path, extract_dir):
    """Extract squashfs filesystem"""
    log("Extracting squashfs filesystem (this may take a while)...", Colors.YELLOW)
    os.makedirs(extract_dir, exist_ok=True)
    try:
        run_command(['unsquashfs', '-f', '-d', extract_dir, str(squashfs_path)])
    except subprocess.CalledProcessError:
        error_exit("Failed to extract squashfs filesystem")

def create_chroot_script():
    """Create the script that will run inside the chroot environment"""
    script = '''#!/bin/bash
set -e
# Update package lists
apt-get update
# Install required packages
apt-get install -y git python3 python3-pip python3-venv
# Clone epistula repository
if [ -d "/opt/epistula" ]; then
    rm -rf /opt/epistula
fi
git clone https://github.com/KiselAnton/epistula.git /opt/epistula
# Run epistula setup
cd /opt/epistula
if [ -f "setup.sh" ]; then
    bash setup.sh
else
    echo "WARNING: setup.sh not found, skipping setup"
fi
# Create desktop shortcut
mkdir -p /etc/skel/Desktop
cat > /etc/skel/Desktop/epistula.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Epistula
Comment=Email Client
Exec=/opt/epistula/run.sh
Icon=/opt/epistula/icon.png
Terminal=false
Categories=Network;Email;
EOF
chmod +x /etc/skel/Desktop/epistula.desktop
# Clean up
apt-get clean
rm -rf /var/lib/apt/lists/*
'''
    return script

def setup_chroot(chroot_dir):
    """Setup and execute commands in chroot environment"""
    log("Setting up chroot environment...", Colors.YELLOW)
    
    # Create installation script
    script_content = create_chroot_script()
    script_path = Path(chroot_dir) / 'tmp' / 'install_epistula.sh'
    script_path.write_text(script_content)
    os.chmod(script_path, 0o755)
    
    # Setup chroot environment
    try:
        # Mount necessary filesystems
        run_command(['mount', '--bind', '/dev', str(Path(chroot_dir) / 'dev')])
        run_command(['mount', '--bind', '/proc', str(Path(chroot_dir) / 'proc')])
        run_command(['mount', '--bind', '/sys', str(Path(chroot_dir) / 'sys')])
        
        # Copy DNS configuration
        shutil.copy('/etc/resolv.conf', Path(chroot_dir) / 'etc' / 'resolv.conf')
        
        log("Installing Epistula in chroot environment...", Colors.YELLOW)
        
        # Execute installation script in chroot
        run_command(['chroot', str(chroot_dir), '/tmp/install_epistula.sh'])
        
        log("Epistula installation completed", Colors.GREEN)
        
    except subprocess.CalledProcessError as e:
        error_exit(f"Failed to setup chroot environment: {e}")
    finally:
        # Cleanup
        log("Cleaning up chroot environment...", Colors.YELLOW)
        script_path.unlink(missing_ok=True)
        Path(chroot_dir, 'etc', 'resolv.conf').unlink(missing_ok=True)
        
        # Unmount filesystems
        for mount in ['dev', 'proc', 'sys']:
            mount_path = Path(chroot_dir) / mount
            try:
                run_command(['umount', str(mount_path)], check=False)
            except:
                pass

def create_squashfs(source_dir, output_file):
    """Create a new squashfs filesystem"""
    log("Creating new squashfs filesystem (this may take a while)...", Colors.YELLOW)
    try:
        run_command(['mksquashfs', str(source_dir), str(output_file), 
                    '-comp', 'xz', '-b', '1M', '-noappend'])
    except subprocess.CalledProcessError:
        error_exit("Failed to create squashfs filesystem")

def update_manifest(chroot_dir, extract_dir):
    """Update filesystem manifest and size files"""
    log("Updating manifest files...", Colors.YELLOW)
    
    manifest_path = Path(extract_dir) / 'casper' / 'filesystem.manifest'
    try:
        result = run_command(
            ['chroot', str(chroot_dir), 'dpkg-query', '-W', 
             '--showformat=${Package} ${Version}\n'],
            check=False
        )
        if result.returncode == 0:
            manifest_path.write_text(result.stdout)
    except Exception as e:
        log(f"Warning: Failed to update manifest: {e}", Colors.YELLOW)
    
    # Update filesystem size
    size_path = Path(extract_dir) / 'casper' / 'filesystem.size'
    try:
        result = run_command(['du', '-sx', '--block-size=1', str(chroot_dir)])
        size = result.stdout.split()[0]
        size_path.write_text(size)
    except Exception as e:
        log(f"Warning: Failed to update filesystem size: {e}", Colors.YELLOW)

def update_checksums(extract_dir):
    """Update MD5 checksums"""
    log("Calculating MD5 checksums...", Colors.YELLOW)
    
    md5sum_path = Path(extract_dir) / 'md5sum.txt'
    try:
        result = run_command(
            "find . -type f -print0 | xargs -0 md5sum | grep -v './md5sum.txt'",
            shell=True, cwd=extract_dir
        )
        md5sum_path.write_text(result.stdout)
    except subprocess.CalledProcessError:
        log("Warning: Failed to update checksums", Colors.YELLOW)

def create_iso(extract_dir, output_iso):
    """Create the final ISO file"""
    log("Creating new ISO file...", Colors.YELLOW)
    
    cmd = [
        'xorriso', '-as', 'mkisofs',
        '-r', '-V', 'Epistula Ubuntu',
        '-o', str(output_iso),
        '-J', '-l',
        '-b', 'isolinux/isolinux.bin',
        '-c', 'isolinux/boot.cat',
        '-no-emul-boot',
        '-boot-load-size', '4',
        '-boot-info-table',
        '-eltorito-alt-boot',
        '-e', 'boot/grub/efi.img',
        '-no-emul-boot',
        '-isohybrid-gpt-basdat',
        str(extract_dir)
    ]
    
    try:
        run_command(cmd)
    except subprocess.CalledProcessError:
        error_exit("Failed to create ISO file")

def autodetect_iso(isos_dir: Path) -> Path:
    """Find the most recent .iso file in the given directory."""
    if not isos_dir.exists():
        return None
    iso_files = sorted(isos_dir.glob('*.iso'), key=lambda p: p.stat().st_mtime, reverse=True)
    return iso_files[0] if iso_files else None

def main():
    """Main function"""
    # If no args, auto-detect input from ./isos and default output name
    input_iso = None
    output_iso = None
    if len(sys.argv) < 2:
        detected = autodetect_iso(Path('./isos'))
        if detected is None:
            # Fall back to old behavior and show usage when no ISO found
            sys.stderr.write("No ISO provided and none found in ./isos.\n")
            print(__doc__)
            sys.exit(1)
        warn(f"No arguments supplied. Auto-selected input ISO: {detected}")
        input_iso = detected
        output_iso = Path('epistula-ubuntu.iso')
    else:
        input_iso = Path(sys.argv[1])
        output_iso = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('epistula-ubuntu.iso')
    
    # Validate input
    if not Path(input_iso).exists():
        error_exit(f"Input ISO not found: {input_iso}")
    
    check_root()
    check_dependencies()
    
    # Create temporary directories
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        mount_dir = temp_path / 'mount'
        extract_dir = temp_path / 'extract'
        squashfs_dir = temp_path / 'squashfs'
        
        try:
            # Mount and extract ISO
            mount_iso(input_iso, mount_dir)
            extract_iso(mount_dir, extract_dir)
            
            # Unmount ISO
            run_command(['umount', str(mount_dir)])
            
            # Extract squashfs
            squashfs_file = extract_dir / 'casper' / 'filesystem.squashfs'
            if not squashfs_file.exists():
                error_exit(f"Squashfs file not found: {squashfs_file}")
            
            extract_squashfs(squashfs_file, squashfs_dir)
            
            # Setup chroot and install Epistula
            setup_chroot(squashfs_dir)
            
            # Create new squashfs
            squashfs_file.unlink()
            create_squashfs(squashfs_dir, squashfs_file)
            
            # Update manifest and checksums
            update_manifest(squashfs_dir, extract_dir)
            update_checksums(extract_dir)
            
            # Create final ISO
            create_iso(extract_dir, output_iso)
            
            log(f"\nSUCCESS: New ISO created at {output_iso}", Colors.GREEN)
            log("You can now burn this ISO to a USB drive or CD", Colors.GREEN)
            
        except Exception as e:
            error_exit(str(e))
        finally:
            # Cleanup mounted filesystems
            try:
                run_command(['umount', str(mount_dir)], check=False)
            except:
                pass

if __name__ == '__main__':
    main()
