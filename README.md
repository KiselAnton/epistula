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
   - Copy `.env.example` to `.env` in both backend and frontend directories
   - Update with your local configuration

6. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   uvicorn main:app --reload
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

### Using Docker (Recommended)

```bash
docker-compose up -d
```

This will start all services (backend, frontend, database, Keycloak, Ollama) with proper networking.

## Development Roadmap

### Phase 1: Foundation
- [ ] Set up development environment
- [ ] Initialize FastAPI backend structure
- [ ] Configure PostgreSQL database with initial schema
- [ ] Set up basic authentication with Keycloak
- [ ] Create Next.js frontend scaffold
- [ ] Establish API contracts between frontend and backend

### Phase 2: Core Features
- [ ] Implement user registration and login flows
- [ ] Build letter composition interface
- [ ] Create letter storage and retrieval system
- [ ] Implement peer-to-peer letter exchange
- [ ] Design and implement letter threading/conversation view
- [ ] Add basic notification system

### Phase 3: AI Integration
- [ ] Integrate Ollama for AI letter generation
- [ ] Create AI conversation interface
- [ ] Implement context management for AI exchanges
- [ ] Add AI writing assistance features
- [ ] Build AI response customization options

### Phase 4: Enhancement
- [ ] Add rich text formatting support
- [ ] Implement attachment handling
- [ ] Create user profiles and settings
- [ ] Add search and filtering capabilities
- [ ] Implement letter archiving system
- [ ] Add export functionality

### Phase 5: Polish
- [ ] Comprehensive testing suite
- [ ] Performance optimization
- [ ] Security audit and hardening
- [ ] Documentation (user guide, API docs)
- [ ] Deployment pipeline setup
- [ ] Monitoring and logging infrastructure

## Contributing

We welcome contributions! Here's how you can help:

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
   - Write clean, documented code
   - Follow existing code style and conventions
   - Add tests for new features
4. **Commit your changes**
   ```bash
   git commit -m "Add: brief description of changes"
   ```
5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request**
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure all tests pass

### Code Style Guidelines

- **Python**: Follow PEP 8, use type hints
- **JavaScript/TypeScript**: Follow Airbnb style guide
- **Commits**: Use conventional commit messages (feat:, fix:, docs:, etc.)
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Questions or Need Help?

Feel free to:
- Open an issue for bugs or feature requests
- Start a discussion for general questions
- Contact the maintainers directly

Thank you for contributing to Epistula! 🎉
