# Epistula Backend - Virtual Environment Setup

## Environment Information

- **Python Version**: 3.14.0
- **Virtual Environment**: `venv/` (located in this directory)
- **Status**: ✅ Configured and ready to use

## Quick Start

### Activate Virtual Environment

```powershell
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Your prompt will change to show (venv)
```

### Deactivate Virtual Environment

```powershell
deactivate
```

### Verify Installation

```powershell
# Activate venv first
.\venv\Scripts\Activate.ps1

# Check Python version
python --version
# Should show: Python 3.14.0

# List installed packages
pip list

# Test imports
python -c "import fastapi; import sqlalchemy; import psycopg; print('✅ All packages working!')"
```

## Installed Packages

The following packages are installed in the virtual environment:

### Web Framework
- `fastapi==0.104.1` - Modern web framework
- `uvicorn[standard]==0.24.0` - ASGI server
- `python-multipart==0.0.6` - Form data parsing

### Data Validation
- `pydantic[email]>=2.0.0` - Data validation with email support

### Database
- `sqlalchemy>=2.0.35` - SQL toolkit and ORM (Python 3.14 compatible)
- `psycopg[binary]>=3.2.0` - PostgreSQL adapter (version 3)
- `alembic>=1.13.0` - Database migrations

### Authentication & Security
- `python-jose[cryptography]==3.3.0` - JWT token handling
- `passlib[bcrypt]==1.7.4` - Password hashing
- `python-dotenv==1.0.0` - Environment variable management

### Utilities
- `python-dateutil==2.8.2` - Date/time utilities

## Managing Dependencies

### Install New Package

```powershell
# Activate venv first
.\venv\Scripts\Activate.ps1

# Install package
pip install package-name

# Add to requirements.txt
pip freeze | Select-String package-name >> requirements.txt
```

### Update Packages

```powershell
# Update all packages
pip install --upgrade -r requirements.txt

# Update specific package
pip install --upgrade package-name
```

### Reinstall All Dependencies

```powershell
# If you need to recreate the environment
pip install -r requirements.txt
```

## Running the Backend

### Development Mode

```powershell
# Activate venv
.\venv\Scripts\Activate.ps1

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```powershell
# Activate venv
.\venv\Scripts\Activate.ps1

# Run without reload
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Database Connection

### Environment Variables Required

Create a `.env` file in the project root (see `.env.example`):

```env
DB_HOST=database
DB_PORT=5432
DB_NAME=epistula
DB_USER=epistula_user
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
```

### Test Database Connection

```powershell
# Activate venv
.\venv\Scripts\Activate.ps1

# Test connection (requires database running)
python -c "from database import check_database_connection; print('DB OK' if check_database_connection() else 'DB FAILED')"
```

## Troubleshooting

### "Scripts disabled" Error

If you get an error about script execution being disabled:

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Import Errors

If you get import errors after activating:

```powershell
# Verify you're in the venv
python -c "import sys; print(sys.prefix)"
# Should show path ending in \venv

# Reinstall if needed
pip install --force-reinstall -r requirements.txt
```

### Wrong Python Version

If `python --version` shows wrong version:

```powershell
# Deactivate and reactivate
deactivate
.\venv\Scripts\Activate.ps1
```

## Development Workflow

1. **Start your day**
   ```powershell
   cd d:\epistula\epistula\epistula\backend
   .\venv\Scripts\Activate.ps1
   ```

2. **Make changes** to code

3. **Test changes**
   ```powershell
   python -m pytest  # If tests are set up
   # or
   uvicorn main:app --reload
   ```

4. **Deactivate when done**
   ```powershell
   deactivate
   ```

## Notes

- **Never commit `venv/`** directory to git (already in `.gitignore`)
- **Always activate** venv before running Python commands
- **Keep `requirements.txt` updated** when adding new packages
- **Use Python 3.14** features carefully - some libraries may not be fully compatible yet

## Python 3.14 Compatibility Notes

⚠️ **Important**: Python 3.14 is a recent release. Some notes:

- ✅ FastAPI: Working
- ✅ SQLAlchemy 2.0.44+: Working (older versions incompatible)
- ✅ Psycopg3: Working (psycopg2 doesn't support 3.14 yet)
- ✅ Pydantic: Working
- ⚠️ Some packages may need updates as ecosystem catches up

If you encounter compatibility issues, you can:
1. Downgrade to Python 3.12 (`py -3.12 -m venv venv`)
2. Wait for package updates
3. Use older package versions that work

## Links

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/)
- [Psycopg3 Docs](https://www.psycopg.org/psycopg3/)
- [Python 3.14 Release Notes](https://docs.python.org/3.14/whatsnew/3.14.html)
