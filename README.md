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

5. **Configure Environment Variables**
   
   Create `.env` files in both backend and frontend directories based on the provided `.env.example` files.

6. **Run the Application**
   
   ```bash
   # Start backend
   cd backend
   uvicorn main:app --reload
   
   # Start frontend (in a new terminal)
   cd frontend
   npm run dev
   ```

### Using Docker (Recommended)

The easiest way to get Epistula running is with Docker Compose:

```bash
docker compose up -d
```

This will start all services (backend, frontend, database, Ollama, Keycloak) in containers.

## Building Custom Ubuntu ISO with Epistula

### Overview

Epistula includes a script (`setup_epistula_iso.sh`) that creates a custom Ubuntu ISO with Docker, Docker Compose, and Epistula pre-installed. This is useful for distributing Epistula as a ready-to-use system.

### ISO Building Workflow

#### Prerequisites for ISO Building

- Linux system (Ubuntu/Debian recommended)
- Root/sudo access
- At least 10GB free disk space
- Dependencies (automatically installed by script):
  - wget
  - xorriso
  - squashfs-tools
  - git

#### Using the isos Folder (Recommended)

**To save bandwidth and time**, you can place Ubuntu ISOs in the `isos/` folder before running the build script. The script will automatically detect and use existing ISOs instead of downloading them.

**Workflow:**

1. **Create the isos directory** (if it doesn't exist):
   ```bash
   mkdir -p isos
   ```

2. **Download Ubuntu ISO manually** (optional but recommended):
   ```bash
   cd isos
   wget https://releases.ubuntu.com/22.04/ubuntu-22.04.3-live-server-amd64.iso
   cd ..
   ```
   
   Or copy an existing ISO:
   ```bash
   cp /path/to/ubuntu-22.04.3-live-server-amd64.iso isos/
   ```

3. **Run the ISO build script**:
   ```bash
   sudo ./setup_epistula_iso.sh
   ```

#### How the ISO Check Works

The build script follows this priority order:

1. **Check `isos/` folder** - If ISO exists here, copy it to work directory
2. **Check work directory** - If ISO already exists in `./iso_work/`, skip download
3. **Download** - If ISO not found in either location, download from Ubuntu servers

This approach:
- ✅ Saves bandwidth on repeated builds
- ✅ Speeds up the build process
- ✅ Allows offline ISO building
- ✅ Supports custom Ubuntu versions

#### Build Output

After successful completion, you'll find:

- **Custom ISO**: `./iso_work/epistula-ubuntu.iso`
- This ISO can be used to install Ubuntu with Epistula pre-configured
- The ISO includes:
  - Docker and Docker Compose
  - Epistula source code in `/opt/epistula`
  - Automatic Epistula service startup
  - User guide at `/opt/epistula/USER_GUIDE.md`

#### Developer Tips

- **Keep ISOs between builds**: Place ISOs in `isos/` folder and add `isos/*.iso` to `.gitignore` (already done)
- **Test different Ubuntu versions**: Download different ISOs to `isos/` and modify the script's `UBUNTU_VERSION` variable
- **Clean builds**: Remove `./iso_work/` directory to start fresh (but keep `isos/` intact)
- **Share ISOs with team**: Keep a shared `isos/` directory to avoid multiple downloads

#### Example: Quick Build Workflow

```bash
# First time setup
mkdir -p isos
wget -P isos https://releases.ubuntu.com/22.04/ubuntu-22.04.3-live-server-amd64.iso

# Build ISO (will use local ISO from isos/)
sudo ./setup_epistula_iso.sh

# The ISO is ready at: ./iso_work/epistula-ubuntu.iso

# For subsequent builds, just run:
sudo ./setup_epistula_iso.sh  # No download needed!
```

## Contributing

We welcome contributions! Here's how to get started:

### Code Contribution Guidelines

1. **Fork the repository** and create a feature branch
2. **Write clean, documented code**
3. **Follow existing code style** (PEP 8 for Python, ESLint for JavaScript)
4. **Add tests** for new features
5. **Update documentation** as needed
6. **Submit a pull request** with a clear description

### Pull Request Process

1. Update the README.md with details of changes if needed
2. Ensure all tests pass
3. Get approval from at least one maintainer
4. Squash commits before merging if requested

### Code Style Guidelines

- **Python**: Follow PEP 8, use type hints
- **JavaScript/TypeScript**: Follow Airbnb style guide
- **Commits**: Use conventional commits format
- **Testing**: Write unit tests for new features

### Areas Where We Need Help

- Frontend UI/UX improvements
- Backend API optimization
- AI prompt engineering
- Documentation and tutorials
- Testing and bug fixes
- Accessibility improvements

## API Documentation

Once the backend is running, API documentation is available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

### Backend Tests

```bash
cd backend
pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Architecture Overview

### Backend Architecture

- FastAPI handles HTTP requests and responses
- SQLAlchemy ORM manages database interactions
- Keycloak provides OAuth2/OIDC authentication
- Ollama integration for AI-powered letter generation

### Frontend Architecture

- Next.js for server-side rendering and routing
- React for component-based UI
- State management with React Context/Redux
- API calls through axios/fetch

### Database Schema

- Users: Authentication and profile information
- Letters: Letter content, metadata, and threading
- Conversations: Groups letters into threads
- AI_Contexts: Maintains context for AI conversations

## Troubleshooting

### Common Issues

**Database connection errors**
- Ensure PostgreSQL is running
- Check database credentials in `.env`

**Ollama not responding**
- Verify Ollama service is running: `ollama serve`
- Check if models are downloaded: `ollama list`

**Frontend not connecting to backend**
- Verify backend is running on correct port
- Check CORS configuration in backend

**ISO build fails**
- Ensure you have root/sudo access
- Check available disk space (need ~10GB)
- Verify all dependencies are installed
- Try placing ISO manually in `isos/` folder

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Questions or Need Help?

Feel free to:

- Open an issue for bugs or feature requests
- Start a discussion for general questions
- Contact the maintainers directly

Thank you for contributing to Epistula! 🎉
