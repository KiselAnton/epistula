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
   python manage.py migrate
   ```

4. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

5. **Start Backend**
   ```bash
   cd ../backend
   uvicorn main:app --reload
   ```

## ISO Management

The `isos/` directory is designed to hold Ubuntu Desktop ISO files for classroom setups:

- **Current version**: Ubuntu 24.04.3 Desktop (updated from 22.04)
- **Purpose**: Allows professors to create bootable USB drives for student computers
- **Size**: ~5.8 GB
- **Download URL**: https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-desktop-amd64.iso

Place the ISO file in the `isos/` directory to skip automatic downloads during setup.

## Features

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

## Update Workflow for Admins

After initial installation, admins can update the Epistula application to get the latest features and bug fixes using the automated update script.

### Automated Update (Recommended)

1. **Navigate to repository directory**
   ```bash
   cd /path/to/epistula
   ```

2. **Run the update script**
   ```bash
   sudo ./update_epistula.sh
   ```

The update script will:
- Pull the latest code from the repository
- Check and restart backend services if running
- Rebuild Docker containers if present
- Display the new version number

### Manual Update Process

If you prefer to update manually:

1. **Pull latest code**
   ```bash
   cd /path/to/epistula
   git pull origin master
   ```

2. **Update backend dependencies** (if changed)
   ```bash
   cd epistula/backend
   pip install -r requirements.txt
   ```

3. **Restart services**
   ```bash
   # For systemd services
   sudo systemctl restart epistula-backend
   
   # For Docker
   docker-compose down
   docker-compose up -d --build
   ```

4. **Verify the update**
   ```bash
   # Check health endpoint
   curl http://localhost:8000/health
   
   # Check version
   curl http://localhost:8000/version
   ```

### Version Information

The current version is stored in `epistula/backend/VERSION` file. The backend API exposes this via the `/version` endpoint:

```bash
curl http://localhost:8000/version
# Returns: {"version": "0.1.0", "service": "Epistula ISO"}
```

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
