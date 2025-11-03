# Epistula Testing Guide

This document describes the test suite for Epistula's role-based editor restrictions and storage functionality.

## Frontend Tests

### Location
- `frontend/utils/__tests__/auth.test.ts` - Authentication utility tests
- `frontend/components/common/__tests__/WysiwygMarkdownEditor.test.tsx` - Editor component tests

### Running Frontend Tests

```bash
cd epistula/frontend

# Run tests in watch mode (development)
npm test

# Run tests once with coverage (CI)
npm run test:ci

# Run E2E tests
npm run test:e2e
```

### Frontend Test Coverage

#### Auth Utilities (`utils/auth.ts`)
- ✅ `getCurrentUser()` returns null when no user stored
- ✅ `getCurrentUser()` handles invalid JSON gracefully
- ✅ `getCurrentUser()` returns parsed user object
- ✅ `getCurrentUserRole()` returns correct role for all user types
- ✅ Edge cases: missing fields, null values, empty strings

#### WYSIWYG Markdown Editor (`components/common/WysiwygMarkdownEditor.tsx`)
- ✅ **Role-based block restrictions:**
  - Students: video and audio blocks removed
  - Root: all blocks available
  - Uni_admin: all blocks available
  - Professor: all blocks available
  - No role (default): all blocks available
- ✅ Component rendering (editor, save button, hints)
- ✅ Save functionality (onClick handler, disabled state)
- ✅ Content change handlers
- ✅ File upload configuration
- ✅ Block count validation (students have 2 fewer blocks)

## Backend Tests

### Location
- `backend/tests/test_storage_endpoints.py` - Storage API tests
- `backend/tests/test_role_based_editor.py` - Integration tests for role-based features

### Running Backend Tests

```bash
cd epistula/backend

# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=term-missing

# Run specific test file
pytest tests/test_storage_endpoints.py -v

# Run specific test
pytest tests/test_storage_endpoints.py::test_upload_file_requires_authentication -v
```

### Backend Test Coverage

#### Storage Endpoints (`routers/storage.py`)
- ✅ Upload requires authentication (401 without token)
- ✅ File size validation (max 10MB)
- ✅ Content type validation (only allowed types)
- ✅ Successful image upload (JPEG, PNG)
- ✅ Successful file upload (PDF, etc.)
- ✅ File retrieval (200 for existing files)
- ✅ File not found (404 for missing files)
- ✅ Correct MIME types returned
- ✅ Cache headers set correctly (31536000 seconds)
- ✅ Support for image/jpg MIME type
- ✅ All roles can upload files

#### Role-Based Editor Integration (`test_role_based_editor.py`)
- ✅ Student role correctly stored and retrievable
- ✅ Professor role has full permissions
- ✅ Uni_admin role has full permissions
- ✅ Root role has full permissions
- ✅ Roles persist across sessions
- ✅ JWT tokens contain role information

## Test Architecture

### Frontend Testing Stack
- **Framework:** Jest 30.x
- **Testing Library:** React Testing Library 16.x
- **User Events:** @testing-library/user-event
- **Matchers:** @testing-library/jest-dom
- **Environment:** jsdom (browser simulation)

### Backend Testing Stack
- **Framework:** pytest
- **HTTP Client:** FastAPI TestClient (based on httpx)
- **Mocking:** unittest.mock
- **Coverage:** pytest-cov

## Key Testing Principles

### 1. Role-Based Restrictions
The editor dynamically filters available blocks based on user role:

```typescript
const isStudent = userRole === 'student';
const blockSpecs = isStudent 
  ? { ...defaultBlockSpecs, video: undefined, audio: undefined }
  : defaultBlockSpecs;
```

Tests verify:
- Students cannot access video/audio blocks
- Staff (root, uni_admin, professor) have full access
- Default behavior (no role) allows all blocks

### 2. Authentication Flow
1. User logs in → backend returns role in JWT response
2. Frontend stores user object in localStorage
3. `getCurrentUserRole()` reads role from localStorage
4. Editor component receives role via prop
5. BlockNote configuration adjusts based on role

Tests verify each step in isolation and integration.

### 3. Storage Security
- All uploads require authentication
- File size limits enforced (10MB)
- Content type whitelist (images, PDFs, etc.)
- S3 errors handled gracefully
- Cache headers optimize performance

## Coverage Requirements

### Frontend
- **Target:** 80%+ coverage for utility functions and components
- **Critical paths:** 100% coverage for role-based logic

### Backend
- **Target:** 100% coverage (enforced by CI)
- **Critical paths:** All authentication, authorization, and storage endpoints

## Continuous Integration

### Pre-push Hook
```bash
# Automatically runs:
1. Backend tests (pytest)
2. Frontend linting (eslint)
3. Blocks push if tests fail
```

### GitHub Actions
```yaml
# On PR and push to main/develop:
- Run backend tests with 100% coverage requirement
- Run frontend tests with coverage reporting
- Run E2E tests (Playwright)
```

## Adding New Tests

### Frontend Component Test Template
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should do something', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByText('Click me');
    await user.click(button);
    
    expect(screen.getByText('Result')).toBeInTheDocument();
  });
});
```

### Backend Endpoint Test Template
```python
def test_my_endpoint(client, set_user):
    """Test description."""
    set_user(id=1, email="test@example.com", role="root")
    
    response = client.get("/api/v1/my-endpoint")
    
    assert response.status_code == 200
    assert response.json()["key"] == "expected_value"
```

## Debugging Tests

### Frontend
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- auth.test.ts

# Update snapshots
npm test -- -u
```

### Backend
```bash
# Run with print statements visible
pytest -s

# Run with detailed output
pytest -vv

# Stop on first failure
pytest -x

# Run last failed tests
pytest --lf
```

## Mock Strategies

### Frontend Mocks
- **BlockNote:** Mock `useCreateBlockNote` and `BlockNoteView` to test config
- **API calls:** Mock `uploadToStorage` to avoid network requests
- **localStorage:** Mocked globally in jest.setup.js

### Backend Mocks
- **Database:** Use pytest fixtures with in-memory database
- **MinIO:** Mock `get_file` and `upload_file` to avoid S3 calls
- **Authentication:** Use `set_user` fixture to simulate logged-in users

## Best Practices

1. **Test behavior, not implementation** - Focus on what users see/do
2. **One assertion per test when possible** - Makes failures clearer
3. **Use descriptive test names** - `test_student_cannot_access_video_blocks`
4. **Clean up after tests** - Clear localStorage, reset mocks
5. **Mock external dependencies** - Database, S3, network calls
6. **Test error paths** - 404, 401, 400, 500 responses
7. **Verify edge cases** - Null values, empty strings, boundary conditions

## Troubleshooting

### "toBeInTheDocument is not defined"
- Ensure `jest.d.ts` includes `/// <reference types="@testing-library/jest-dom" />`
- Verify `@testing-library/jest-dom` is imported in `jest.setup.js`

### "localStorage is not defined"
- Check `jest.setup.js` includes localStorage mock

### Backend tests fail with "create_all() already called"
- Ensure test database is properly torn down
- Use `pytest --create-db` if needed

### Coverage not 100%
- Run `pytest --cov=. --cov-report=html` to see HTML report
- Open `htmlcov/index.html` to see uncovered lines

## Related Documentation

- [Development Guide](../../DEV_GUIDE.md)
- [Architecture Documentation](../backend/ARCHITECTURE.md)
- [Frontend Architecture](../frontend/ARCHITECTURE.md)
- [GitHub Copilot Instructions](../../.github/copilot-instructions.md)
