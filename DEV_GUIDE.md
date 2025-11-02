# Developer Quick Reference

## Starting Epistula

### First Time / Fresh Start
```bash
./start_epistula.sh --build
```
This does a full rebuild (takes 3-5 minutes).

### Normal Restart (No Code Changes)
```bash
./start_epistula.sh --restart
```
Fast restart (~15-20 seconds), uses existing images.

### After Frontend Changes (UI, Pages, Components)
```bash
./start_epistula.sh --rebuild-frontend
```
Rebuilds only frontend (~30-60 seconds).

### After Backend Changes (API, Models, Database)
```bash
./start_epistula.sh --rebuild-backend
```
Rebuilds only backend (~20-40 seconds).

### Other Useful Commands
```bash
./start_epistula.sh --status   # Check container status
./start_epistula.sh --logs     # View logs
./start_epistula.sh --stop     # Stop all containers
./start_epistula.sh --clean    # Remove everything
```

## Development Workflow

### When Adding New Frontend Pages/Components
1. Create/edit files in `epistula/frontend/pages/` or `epistula/frontend/components/`
2. Run: `./start_epistula.sh --rebuild-frontend`
3. Refresh browser (hard refresh: Ctrl+F5)

### When Adding New Backend Endpoints
1. Create/edit files in `epistula/backend/`
2. Run: `./start_epistula.sh --rebuild-backend`
3. Test API endpoints

### When Changing Database Schema
1. Create migration in `epistula/database/migrations/`
2. Run migration:
   ```bash
   docker cp epistula/database/migrations/XXX_migration.sql epistula_db:/tmp/
   docker exec epistula_db psql -U epistula_user -d epistula -f /tmp/XXX_migration.sql
   ```
3. Update backend models if needed
4. Run: `./start_epistula.sh --rebuild-backend`

## Common Issues

### "I changed frontend code but don't see changes"
- Solution: `./start_epistula.sh --rebuild-frontend`
- The frontend runs in production mode, so changes need rebuild

### "I changed backend code but API doesn't work"
- Solution: `./start_epistula.sh --rebuild-backend`
- Or check logs: `./start_epistula.sh --logs`

### "Containers won't start"
- Solution: `./start_epistula.sh --clean` then `./start_epistula.sh --build`
- This removes everything and starts fresh

### "Port already in use"
- Check what's running: `./start_epistula.sh --status`
- Stop everything: `./start_epistula.sh --stop`

## Quick Tips

- Frontend runs on: http://localhost:3000
- Backend API runs on: http://localhost:8000
- MinIO console runs on: http://localhost:9001
- Database runs on: localhost:5432

- Frontend code: `epistula/frontend/`
- Backend code: `epistula/backend/`
- Database migrations: `epistula/database/migrations/`

## Repository layout and cleanliness

- `epistula/backend/` — FastAPI backend
- `epistula/frontend/` — Next.js frontend
- `isos/` and `work/` — ISO build artifacts (ignored). `isos/` acts as a cache of downloaded ISOs and is preserved by default by cleanup scripts so you don't re-download large images. Use explicit purge flags to remove it.
- `backups/` — database backups (ignored)

The repository root should stay free of language-specific artifacts. Avoid adding JS/TS files directly at the root; place JavaScript utilities under `epistula/frontend/` (app code) or a `scripts/` directory if needed.

To prevent accidental commits of debug artifacts (e.g., chunk dumps), the root `.gitignore` contains a rule to ignore JavaScript files at the repository root (`/*.js`). If you encounter stray files like `chunk_*.js` or `buildManifest_old_3000.js` at the root, they can be safely deleted.

### Temp/debug folder policy

- Use the top-level `temp/` folder for any ad-hoc/debug files you need to generate locally (scratch SQL, quick logs, debug bundles). The folder is git-ignored.
- Prefer writing temp outputs to `temp/` directly to avoid cluttering the repo root.
- Helpers:
   - Dry-run cleanup: `scripts/clean_workspace.ps1` (Windows) or `./scripts/clean_workspace.sh`
   - Stash stray files to `temp/`: `scripts/clean_workspace.ps1 -Stash` or `./scripts/clean_workspace.sh --stash`
   - Delete matched items: `scripts/clean_workspace.ps1 -Force` or `./scripts/clean_workspace.sh --force`
   - Purge ISO cache if needed: `scripts/clean_workspace.ps1 -Force -PurgeIso` or `./scripts/clean_workspace.sh --force --purge-iso`

What gets stashed (files only): root-only `*.js`, `check_*.sql`, `md5sum.txt`, `boot.catalog`. Large build directory `work/` is left for deletion to save space. `isos/` is preserved by default.

## Testing policy (mandatory)

Every feature or bugfix must include tests in the same commit/PR. The Definition of Done includes automated tests.

- Backend: write pytest tests under `epistula/backend/tests/`. Prefer fast tests; monkeypatch external services (MinIO, schedulers, subprocess calls). For DB integration, use a disposable schema or a throwaway DB in CI.
- Frontend: add Playwright E2E checks under `epistula/frontend/tests-e2e/` for user-visible flows (smoke tests at minimum).
- Keep existing tests green during refactors; extend them when behavior intentionally changes.

### Running tests locally

Backend
```bash
cd epistula/backend
pytest -q
```

Frontend (E2E)
```bash
cd epistula/frontend
npm install
npx playwright install
npm run dev &  # start app in another terminal
npm run test:e2e
```

### CI

All tests run on every push and pull request (see `.github/workflows/ci.yml`). A PR cannot be merged unless tests pass.

## Commit discipline and automation

Always follow these rules:

- Write a good commit message using Conventional Commits, e.g. `feat(backups): add delete endpoint and UI`
- Update or add tests for any behavior changes
- Update relevant docs (README, backend/ARCHITECTURE.md, USER_GUIDE.md, etc.)
- Ensure tests are green locally before committing/pushing
- Rebuild and restart the app to validate end-to-end where applicable

### Install git hooks (one-time per clone)

**Prerequisites:** Before installing hooks, ensure your default `python` command can run pytest with backend dependencies:

**Windows:** The automation scripts use `python -m pytest`. Ensure your `python` command points to an installation with dependencies. You can either:
- Install dependencies globally: `pip install -r epistula\backend\requirements.txt`
- Or use Python's launcher to specify a version: `py -3.14 -m pip install -r epistula\backend\requirements.txt` (then ensure `python` resolves to 3.14)

**Linux/macOS:** Activate the backend virtual environment before running scripts:
```bash
source epistula/backend/venv-wsl/bin/activate
```

**Verify setup:**
```powershell
python -c "import sqlalchemy, pytest; print('OK')"
```

Once Python is configured, install the git hooks:

Windows (PowerShell):
```
scripts\install_hooks.ps1
```

Linux/macOS:
```
./scripts/install_hooks.sh
```

Hooks included:
- `commit-msg`: Enforces Conventional Commits format and subject length
- `pre-push`: Runs backend tests and blocks push if they fail

**Note:** The automation scripts use `python -m pytest`. If tests fail with `ModuleNotFoundError`, ensure your Python environment has the backend dependencies installed.

### Make committing easy after tests

Use these helpers to run tests and commit in one go:

Windows (PowerShell):
```
scripts\commit_after_tests.ps1 -Message "feat(backups): add delete action in UI"
```

Linux/macOS:
```
./scripts/commit_after_tests.sh "feat(backups): add delete action in UI"
```

Optionally add `--push` to push after a successful commit.

## Change Discipline Rules (always do this)

Every change must:

- Include or update tests covering the behavior
- Update relevant docs (README, backend/ARCHITECTURE.md, USER_GUIDE.md, or other docs)
- Run the full test suite locally and ensure green
- Rebuild and restart the app to validate end-to-end

Helper scripts to enforce the flow:

- Windows (PowerShell): `scripts/verify_and_restart.ps1`
- Linux/macOS (Bash): `./scripts/verify_and_restart.sh`

What they do:
- Rebuild and restart backend and frontend containers
- Wait for backend health endpoint (http://localhost:8000/health)
- Wait for frontend to respond (http://localhost:3000/)
- Run backend tests (pytest)
- Report success or failure

For PRs, complete the checklist in `.github/PULL_REQUEST_TEMPLATE.md` to confirm tests, docs, and restart were done.

