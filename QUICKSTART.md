# Epistula - Quick Start Guide

## Starting the Application

### Simple Start (Recommended)
Just run the startup script:

```bash
./start_epistula.sh
```

That's it! The script will:
- Build all Docker containers
- Start backend and frontend services
- Show you the URLs to access the application

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

## Additional Commands

### Stop the Application
```bash
./start_epistula.sh --stop
```

### Restart the Application
```bash
./start_epistula.sh --restart
```

### Check Status
```bash
./start_epistula.sh --status
```

### View Logs
```bash
./start_epistula.sh --logs
```

### Clean Everything
```bash
./start_epistula.sh --clean
```

## Automatic Startup

If you installed from the ISO, containers start automatically on every boot. You don't need to do anything!

## Troubleshooting

### Permission Denied
If you get "permission denied" error:
```bash
chmod +x start_epistula.sh
./start_epistula.sh
```

### Docker Not Running
```bash
sudo systemctl start docker
./start_epistula.sh
```

### Need Sudo
If you're not in the docker group:
```bash
sudo ./start_epistula.sh
```

Or add yourself to the docker group (logout required):
```bash
sudo usermod -aG docker $USER
```

## For Teachers

After installing from the ISO:
1. System boots to desktop automatically
2. Containers start automatically in the background
3. Access the application at http://localhost:3000

If you need to manually restart:
```bash
cd /opt/epistula/src
./start_epistula.sh
```

That's all you need!
