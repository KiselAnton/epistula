# Epistula - Contributor Guide

## Overview

Epistula is a platform for exchanging letters with peers and AI - enabling thoughtful, asynchronous communication. This README is designed for developers and contributors who want to understand the project structure, contribute code, or set up the development environment.

For professors and students looking to understand how to use Epistula, please see the [USER_GUIDE.md](USER_GUIDE.md).

## What is Epistula?

Epistula is a modern take on letter-writing that combines the thoughtfulness of asynchronous correspondence with the power of AI assistance. The platform provides a space for meaningful, deliberate communication - whether writing to peers or engaging with AI.

## Tech Stack

- **Backend**: FastAPI (Python web framework)
- **Database**: PostgreSQL (relational database)
- **AI Integration**: Ollama (local LLM inference)
- **Authentication**: Keycloak (identity and access management)
- **Frontend**: React/Next.js (modern web UI)

## Project Structure

```
epistula/
├── backend/          # FastAPI backend application
├── frontend/         # Next.js/React frontend
├── database/         # Database schemas and migrations
├── docker/           # Docker configuration files
├── isos/             # Place Ubuntu ISOs here to skip downloads
└── docs/             # Additional documentation
```

## Getting Started for Contributors

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 14+
- Docker and Docker Compose (optional but recommended)
- Ollama (for AI features)

### Development Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/KiselAnton/epistula.git
   cd epistula
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb epistula
   
   # Run migrations
   alembic upgrade head
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

5. **Start Development Services**
   ```bash
   # Run all services with docker-compose
   docker-compose up -d
   
   # Or run individual services
   # Backend
   cd backend && uvicorn main:app --reload
   
   # Frontend
   cd frontend && npm run dev
   ```

## ISO Creation (For Deployment)

> **Note**: As of October 2024, the ISO builder has been updated to use **Ubuntu 24.04 LTS** (Noble Numbat) instead of Ubuntu 22.04. All references and scripts have been updated accordingly.

Epistula includes a script to build a custom Ubuntu ISO with all dependencies pre-installed.

### Quick Start

The simplest way to build the ISO:

```bash
sudo ./setup_epistula_iso.sh
```

This will:
1. Check/install dependencies
2. Download Ubuntu 24.04 LTS ISO (if not already present)
3. Customize the ISO with Docker and Epistula
4. Create `epistula-ubuntu.iso`

### Optimizing ISO Builds

The script supports caching ISOs to speed up repeated builds:

**Option 1: Download to `isos/` folder**
```bash
mkdir -p isos
wget https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso -P isos/
```

**Option 2: Copy existing ISO**
```bash
mkdir -p isos
cp /path/to/ubuntu-24.04-live-server-amd64.iso isos/
```

After this, the script will use the cached ISO instead of downloading it.

### What the ISO Contains

The custom ISO includes:

- Ubuntu 24.04 LTS base system
- Docker Engine & Docker Compose
- Epistula repository cloned to `/opt/epistula`
- Systemd service for auto-starting Epistula
- All necessary dependencies

### Using the Custom ISO

1. Boot from the ISO (USB/VM/Physical)
2. Complete Ubuntu installation
3. Epistula will automatically:
   - Start on system boot
   - Be accessible at `http://localhost:8000`
   - Have all services pre-configured

### Build Process Details

The script performs the following steps:

1. **Dependency Check**: Installs `wget`, `xorriso`, `squashfs-tools`, `git`
2. **ISO Download**: Gets Ubuntu 24.04 LTS (if not cached)
3. **ISO Extraction**: Mounts and extracts base ISO
4. **Customization**: 
   - Installs Docker & Docker Compose
   - Clones Epistula repo
   - Creates systemd service
5. **ISO Rebuild**: Repackages as new bootable ISO

### Quick Build Workflow

For contributors doing frequent builds:

```bash
# First time setup
mkdir -p isos
wget -P isos https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso

# Build ISO (uses cached ISO)
sudo ./setup_epistula_iso.sh

# Test in VM
qemu-system-x86_64 -cdrom epistula-ubuntu.iso -m 4G -enable-kvm
```

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the Repository**
2. **Create a Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Make Your Changes**
4. **Run Tests**: Ensure all tests pass
5. **Commit**: `git commit -m 'Add amazing feature'`
6. **Push**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Style

- **Python**: Follow PEP 8
- **JavaScript/React**: Follow ESLint configuration
- **Commits**: Use conventional commits format

### Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## Architecture Overview

### Backend (FastAPI)

- RESTful API design
- JWT-based authentication via Keycloak
- PostgreSQL for data persistence
- Ollama integration for AI features

### Frontend (Next.js/React)

- Server-side rendering
- Modern React with hooks
- Tailwind CSS for styling
- Real-time updates

### AI Integration

- Ollama for local LLM inference
- Supports multiple models
- Privacy-focused (all processing local)

## Deployment

### Docker Deployment (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

See individual service READMEs:
- [Backend Deployment](backend/README.md)
- [Frontend Deployment](frontend/README.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions and support:
- Open an issue on GitHub
- Check the [User Guide](USER_GUIDE.md)
- Review existing documentation in `/docs`

## Acknowledgments

- FastAPI team for the excellent web framework
- Ollama team for making local LLMs accessible
- All contributors who have helped improve Epistula
