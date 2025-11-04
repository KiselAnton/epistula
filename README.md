# Epistula – Educational Management Platform

A modern, containerized educational management system designed for universities, faculties, and course management. Built with FastAPI (Python), Next.js 14 (TypeScript), PostgreSQL, and MinIO for scalable file storage.

## 🔒 **IMPORTANT: Data Safety & Backups**

Your data is stored in Docker named volumes. **Always backup before risky operations!**

📦 **Quick Backup:**
```powershell
# Windows
.\backup_database.ps1

# Linux/Mac
./backup_database.sh
```

⚠️ **Never run these without backing up first:**
- `docker compose down -v` ← **DELETES ALL DATA!**
- `docker volume rm epistula_db_data`
- `docker volume prune`

📖 **See [DATA_SAFETY.md](DATA_SAFETY.md) for complete backup/restore procedures.**

---

## 🎯 Features

- **Multi-tenant University Management** - Isolated database schemas per university
- **Hierarchical Structure** - Universities → Faculties → Subjects → Lectures
- **File Storage** - S3-compatible MinIO for logos and attachments
- **Role-Based Access** - Root users and university-specific permissions
- **Modern UI** - Responsive Next.js frontend with breadcrumb navigation
- **Containerized** - Docker Compose for easy deployment
- **Type-Safe** - Full TypeScript frontend with shared type definitions

## 📁 Project Structure

```
epistula/
├── backend/              # FastAPI application
│   ├── main.py          # App initialization
│   ├── auth.py          # Authentication
│   ├── universities.py  # Universities API
│   ├── faculties.py     # Faculties API
│   ├── subjects.py      # Subjects API
│   ├── models.py        # Data models
│   ├── minio_client.py  # File storage
│   └── ARCHITECTURE.md  # Backend docs
├── frontend/            # Next.js application
│   ├── components/      # Reusable components
│   │   ├── common/      # Shared UI components
│   │   └── layout/      # Layout components
│   ├── pages/           # Next.js pages
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # API utilities
│   ├── types/           # TypeScript definitions
│   └── ARCHITECTURE.md  # Frontend docs
├── database/            # PostgreSQL initialization
│   ├── init/            # Schema and functions
│   └── migrations/      # Database migrations
├── docker-compose.yml   # Container orchestration
└── start_epistula.sh    # Management script
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Bash shell (WSL on Windows)

### Installation

1. **Clone the repository:**
```bash
cd /path/to/epistula
```

2. **Start the application:**
```bash
./start_epistula.sh
```

3. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs
- MinIO Console: http://localhost:9001

4. **Default Login:**
- Password: `changeme123` ⚠️ **Change in production!**

## 🔧 Development Workflow

### Quick Commands:
```bash
# Start everything
./start_epistula.sh

# Rebuild frontend after UI changes
./start_epistula.sh --rebuild-frontend

# Rebuild backend after API changes
./start_epistula.sh --rebuild-backend

# View logs
./start_epistula.sh --logs

# Check status
./start_epistula.sh --status

# Stop containers
./start_epistula.sh --stop

# Full rebuild
./start_epistula.sh --build
```

See [DEV_GUIDE.md](DEV_GUIDE.md) for detailed workflows.

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - 2-minute setup guide
- **[USER_GUIDE.md](USER_GUIDE.md)** - User documentation
- **[DEV_GUIDE.md](DEV_GUIDE.md)** - Developer quick reference
- **[CODESTYLE.md](CODESTYLE.md)** - Coding standards
- **[frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md)** - Frontend architecture
- **[backend/ARCHITECTURE.md](backend/ARCHITECTURE.md)** - Backend architecture

## 🏗️ Architecture Overview

### Backend (FastAPI)
- **RESTful API** design with OpenAPI docs
- **Dynamic schemas** - Each university gets isolated `uni_<id>` schema
- **JWT authentication** with role-based access
- **MinIO storage** for S3-compatible file uploads
- **Cascade deletion** for referential integrity

### Frontend (Next.js)
- **Modular components** - Reusable Modal, Card, Dialog, etc.
- **Custom hooks** - `useUniversities()`, `useFaculties()`, etc.
- **Type-safe API layer** - Centralized API functions
- **Smart navigation** - Breadcrumb trails through hierarchy

### Database (PostgreSQL 16)
- **Public schema** - Users, Universities registry
- **Per-university schemas** - `uni_<id>` contains:
  - Faculties
  - Subjects
  - Lectures
  - Enrollments
  - Content
- **Database functions** - Automated schema creation/deletion
- **Foreign key cascades** - Automatic cleanup

## 🎓 Entity Hierarchy

```
Universities (🏛️)
  └─ Faculties (🎓)
      └─ Subjects (📚)
          └─ Lectures (📖)
              ├─ Content (Markdown, HTML, etc.)
              └─ Assignments (Coming soon)
```

## 📡 API Endpoints

```
/api/v1/
├── auth/
│   ├── POST /login              # Authenticate user
│   └── POST /register           # Register new user
├── universities/
│   ├── GET /                    # List all universities
│   ├── POST /                   # Create university (root only)
│   ├── DELETE /{id}             # Delete university + schema
│   └── POST /{id}/logo          # Upload logo
├── faculties/
│   ├── GET /{university_id}     # List faculties
│   ├── POST /{university_id}    # Create faculty
│   ├── DELETE /{university_id}/{faculty_id}
│   └── POST /{university_id}/{faculty_id}/logo
├── subjects/
│   ├── GET /{university_id}/{faculty_id}
│   ├── POST /{university_id}/{faculty_id}
│   └── DELETE /{university_id}/{faculty_id}/{subject_id}
└── storage/
    └── GET /{file_path}         # Serve files from MinIO
```

Full API docs: http://localhost:8000/docs

## 🔐 Security Features

- ✅ JWT-based authentication
- ✅ Role-based access control (Root, Admin, User)
- ✅ SQL injection prevention (parameterized queries)
- ✅ File upload validation (type, size)
- ✅ CORS configuration
- ✅ Environment-based secrets

## 🛠️ Technology Stack

**Backend:**
- FastAPI 0.104.1
- Python 3.14
- PostgreSQL 16
- SQLAlchemy 2.0
- MinIO (S3-compatible)
- Uvicorn (ASGI server)

**Frontend:**
- Next.js 14
- TypeScript 5
- React 18
- CSS Modules

**Infrastructure:**
- Docker & Docker Compose
- Ubuntu Server (for ISO builds)

## 🚨 Production Checklist

Before deploying to production:

- [ ] Change root password (env: `ROOT_PASSWORD`)
- [ ] Enable database backups
- [ ] Set up monitoring/logging
- [ ] Review security settings
- [ ] Use strong JWT secret

## 🐛 Troubleshooting

**Frontend not updating after code changes?**
```bash
./start_epistula.sh --rebuild-frontend
```

**Backend not loading new endpoints?**
```bash
./start_epistula.sh --rebuild-backend
```

**Database connection errors?**
```bash
./start_epistula.sh --status
# Check if epistula_db is healthy
```

**Can't login?**
- Default: `root@localhost.localdomain` / `root`
- Check backend logs: `./start_epistula.sh --logs`

**MinIO not working?**
- Check: http://localhost:9001
- Default credentials in docker-compose.yml

## 📈 Roadmap

- [x] University management
- [x] Faculty management
- [x] Subject management
- [x] File storage (MinIO)
- [x] Cascade deletion
- [ ] Lecture content management
- [ ] Student enrollment
- [ ] Professor assignments
- [ ] Attendance tracking
- [ ] Grading system
- [ ] AI-powered features

## 🤝 Contributing

Contributions are welcome! Please:

1. Read [CODESTYLE.md](CODESTYLE.md)
2. Follow the architecture patterns
3. Add tests for new features
4. Update documentation
5. Submit PR with clear description

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 👥 Authors

Epistula Development Team

---

**Need help?** Check [USER_GUIDE.md](USER_GUIDE.md) or [DEV_GUIDE.md](DEV_GUIDE.md)
