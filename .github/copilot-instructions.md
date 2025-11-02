# GitHub Copilot Instructions for Epistula

## Project Overview

Epistula is a university management system with a FastAPI backend, Next.js/React frontend, PostgreSQL database, and MinIO object storage. The system uses per-university database schemas and enforces strict quality gates.

## Core Development Rules

### 1. Feature Implementation Workflow

When implementing any feature, **always** follow this sequence:

1. **Implement the feature** (backend API, frontend UI, database changes)
2. **Write comprehensive tests** for the new code (100% coverage required)
3. **Restart the application** to validate end-to-end
4. **Run the full test suite** to ensure nothing breaks
5. **Fix any issues** (fix the implementation first, then update tests if needed)
6. **Commit the change** with a proper Conventional Commit message

**Never skip tests.** Every code change must include corresponding test coverage.

### 2. Testing Requirements

- **100% code coverage is mandatory** for all backend code
- If you change backend code under `epistula/backend/`, you **must** also update or add tests under `epistula/backend/tests/`
- Tests must pass **before** committing
- Run tests with: `cd epistula/backend && pytest -q --tb=short`
- For coverage check: `pytest -q --tb=short --cov=. --cov-report=term-missing --cov-fail-under=100`

### 3. Restart-First Testing

Always restart the application before running tests:

**Windows (PowerShell):**
```powershell
.\scripts\verify_and_restart.ps1
```

**Linux/macOS (Bash):**
```bash
./scripts/verify_and_restart.sh
```

This rebuilds containers, waits for health checks, and runs the test suite.

### 4. Commit Discipline

- Use **Conventional Commits** format: `<type>(scope): <description>`
  - Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`, `style`, `revert`
  - Example: `feat(backups): add metadata for backup files`
- Subject line max 100 characters
- Include a body for non-trivial changes explaining what/why
- **Commit after every complete, tested change** (not in batches)

### 5. Bug Fixing Priority

When something fails:

1. **Fix the implementation first** (the actual bug in the code)
2. **Then** update tests if they need adjustment
3. **Never** just update tests to match broken behavior

If tests fail, it usually means the code is wrong, not the tests.

## Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.14)
- **Database:** PostgreSQL 16
  - Global tables in `public` schema (users, universities)
  - Per-university schemas: `uni_<id>` (faculties, subjects, lectures, etc.)
- **Storage:** MinIO (S3-compatible)
- **ORM:** SQLAlchemy
- **Validation:** Pydantic v2
- **Testing:** pytest + httpx
- **Key patterns:**
  - Dependency injection for DB sessions and auth
  - Role-based access control (root, uni_admin, professor, student)
  - Schema isolation per university

### Frontend
- **Framework:** Next.js (React, TypeScript)
- **Styling:** CSS Modules
- **State:** React hooks (no global state library yet)
- **API:** Direct fetch to backend (consider creating a typed client)

### Database Schema Patterns

- Universities stored in `public.universities`
- Each university gets a dedicated schema: `uni_1`, `uni_2`, etc.
- Schema creation handled by `create_university()` DB function
- Faculties, subjects, lectures live in university-specific schemas
- Users in `public.users` with roles mapped via `public.user_university_roles`

## Code Quality Standards

### Backend Code
- Validate all inputs with Pydantic models
- Trim and normalize user input (e.g., uppercase codes, strip whitespace)
- Return appropriate HTTP status codes (400 for validation, 403 for auth, 404 for not found, 500 for server errors)
- Use dependency injection for `get_db()` and `get_current_user()`
- Never expose stack traces to clients in production
- Always use parameterized queries (SQLAlchemy or `text()` with params)

### Frontend Code
- Validate inputs client-side before submission
- Display clear error messages from API responses
- Use TypeScript interfaces for all API response shapes
- Keep components focused and reusable
- Use CSS Modules for styling (avoid inline styles except for dynamic values)

### Testing Code
- Test happy paths **and** error cases
- Mock external dependencies (database, storage, etc.)
- Use descriptive test names: `test_<feature>_<scenario>_<expected_outcome>`
- Isolate tests (no shared state between tests)
- Cover edge cases: empty strings, whitespace, null values, boundary conditions

## Common Patterns

### Adding a New Endpoint

1. Define Pydantic request/response models in `utils/models.py`
2. Add the route in appropriate router (`routers/<module>.py`)
3. Add authorization checks (`get_current_user`, role validation)
4. Implement business logic
5. **Write tests** in `tests/test_<module>.py`:
   - Test success case
   - Test 401/403 for unauthorized
   - Test 400 for bad input
   - Test 404 for missing resources
6. Restart app and run tests
7. Update `backend/ARCHITECTURE.md` with new endpoint
8. Commit with `feat(<module>): <description>`

### Adding a Database Migration

1. Create `epistula/database/migrations/XXX_description.sql`
2. Apply manually in dev: `docker cp <file> epistula_db:/tmp/; docker exec epistula_db psql -U epistula_user -d epistula -f /tmp/<file>`
3. Update initialization scripts if schema-level changes
4. Document in `DEV_GUIDE.md` if needed
5. Commit with `feat(db): <description>`

### Frontend UI Change

1. Update component in `epistula/frontend/components/` or `pages/`
2. Update TypeScript types in `types/index.ts` if API contract changes
3. Test in browser (localhost:3000)
4. Verify responsive behavior
5. Commit with `feat(ui): <description>` or `fix(ui): <description>`

## File Organization

```
epistula/
├── backend/
│   ├── routers/          # API endpoints (auth, universities, faculties, subjects, etc.)
│   ├── middleware/       # Auth middleware
│   ├── utils/            # Models, database, MinIO client, helpers
│   ├── tests/            # All backend tests (pytest)
│   └── main.py           # FastAPI app entry point
├── database/
│   ├── init/             # DB initialization scripts (run on first start)
│   └── migrations/       # Schema migrations (manual application)
├── frontend/
│   ├── components/       # React components (organized by feature)
│   ├── pages/            # Next.js pages (routes)
│   ├── lib/              # API client, config
│   ├── types/            # TypeScript type definitions
│   └── styles/           # CSS Modules
├── .github/
│   └── workflows/        # CI/CD (lint-test.yml)
├── .githooks/            # Git hooks (pre-push, commit-msg)
└── scripts/              # Helper scripts (verify_and_restart, install_hooks, etc.)
```

## Automation and CI

- **Pre-push hook:** Rebuilds app, health-checks, runs tests, blocks push if tests fail or if backend code changed without test changes
- **GitHub Actions:** Runs on PRs and pushes to main/develop; enforces 100% coverage and tests-changed policy
- **Local helpers:**
  - `scripts/verify_and_restart.ps1` (Windows) or `.sh` (Linux/Mac): Full rebuild + test cycle
  - `scripts/commit_after_tests.ps1` (Windows) or `.sh` (Linux/Mac): Run tests then commit

## Anti-Patterns to Avoid

❌ **Don't:**
- Skip writing tests ("I'll add them later")
- Commit without running tests first
- Change tests to pass without fixing the underlying bug
- Use hardcoded credentials or secrets
- Expose internal error details to API clients
- Allow empty or whitespace-only strings where meaningful values are required
- Fetch all records without pagination for large datasets
- Use `SELECT *` in production queries

✅ **Do:**
- Write tests as you implement features
- Validate and sanitize all user input
- Return clear, actionable error messages
- Use environment variables for configuration
- Handle edge cases (null, empty, out-of-range)
- Paginate large result sets
- Restart the app and validate end-to-end before committing

## Examples

### Example: Adding a "Notes" field to Subjects

**Step 1: Backend**
```python
# utils/models.py - add to SubjectBase
notes: Optional[str] = None

# routers/subjects.py - update creation/update logic to include notes
```

**Step 2: Write Tests**
```python
# tests/test_subjects.py
def test_create_subject_with_notes(client, ...):
    # Test creating subject with notes
    
def test_update_subject_notes(client, ...):
    # Test updating notes field
```

**Step 3: Frontend**
```typescript
// types/index.ts
export interface Subject {
  // ... existing fields
  notes: string | null;
}

// pages/subject/[id].tsx - add notes textarea
```

**Step 4: Restart and Test**
```powershell
.\scripts\verify_and_restart.ps1
```

**Step 5: Commit**
```bash
git add .
git commit -m "feat(subjects): add optional notes field

- Backend: add notes to SubjectBase model and CRUD endpoints
- Frontend: add notes textarea in subject editor
- Tests: cover notes creation and update scenarios
- Docs: update ARCHITECTURE.md with notes field"
git push
```

---

## Summary

**Every feature needs:**
1. Implementation (backend + frontend)
2. Tests (100% coverage)
3. Restart + verification
4. Commit with Conventional Commits

**When things break:**
1. Fix the code first
2. Then update tests if needed

**Before pushing:**
- Tests must pass
- App must restart cleanly
- Coverage must be 100%

This workflow is enforced by git hooks and CI—make it a habit and you'll ship quality code every time.
