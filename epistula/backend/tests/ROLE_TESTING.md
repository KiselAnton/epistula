# Role-Based Testing Strategy for Epistula

## Overview

This document outlines the comprehensive testing approach for different user roles (root, uni_admin, professor, student) in the Epistula system.

## Current Test Coverage

### Working Tests (166 passing)
- ✅ **Root user tests**: Full coverage (existing 157 tests)
- ✅ **Basic role authorization**: Simple permission denial tests (9 new tests)
  - Admin cannot create/delete universities
  - Professor cannot create universities/faculties
  - Student cannot create universities/faculties/lectures
  - All roles can upload files

### In-Progress Tests (22 tests with mocking issues)
The following test scenarios are implemented but currently fail due to complex database mocking challenges:
- Admin viewing own university only
- Admin creating faculties/users in assigned university
- Professor creating/updating/deleting lectures in assigned subjects
- Student seeing only published lectures
- Student restricted from unassigned subjects

## Role Permission Matrix

| Action | Root | Uni Admin | Professor | Student |
|--------|------|-----------|-----------|---------|
| Create University | ✅ | ❌ | ❌ | ❌ |
| Delete University | ✅ | ❌ | ❌ | ❌ |
| View All Universities | ✅ | ❌ (own only) | ❌ (assigned only) | ❌ (assigned only) |
| Create Faculty | ✅ | ✅ (in own uni) | ❌ | ❌ |
| Create Subject | ✅ | ✅ (in own uni) | ❌ | ❌ |
| Create Lecture | ✅ | ✅ (any subject) | ✅ (assigned subjects) | ❌ |
| Update Lecture | ✅ | ✅ (any) | ✅ (assigned) | ❌ |
| Delete Lecture | ✅ | ✅ (any) | ✅ (assigned) | ❌ |
| View Unpublished Lectures | ✅ | ✅ | ✅ (assigned) | ❌ |
| View Published Lectures | ✅ | ✅ | ✅ | ✅ (assigned only) |
| Assign Professor to Subject | ✅ | ✅ | ❌ | ❌ |
| Assign Student to Subject | ✅ | ✅ | ✅ (assigned subjects) | ❌ |
| Create User | ✅ | ✅ (in own uni) | ❌ | ❌ |
| Delete User | ✅ | ✅ (in own uni) | ❌ | ❌ |
| Upload Files | ✅ | ✅ | ✅ | ✅ |
| Create Backup | ✅ | ❌ | ❌ | ❌ |
| Restore Backup | ✅ | ❌ | ❌ | ❌ |

## Implementation Challenges

### Database Mocking Complexity
The current tests attempt to mock database sessions partially, but many endpoints execute real SQL queries that bypass the mocks. This causes:
1. **Type errors**: SQLAlchemy ORM queries expect specific database types
2. **Missing data**: Real queries find no data in test database
3. **Permission checks**: Mix of mocked and real queries creates inconsistent state

### Recommended Approaches

#### Approach 1: End-to-End Integration Tests (Recommended)
- Use actual test database with real data
- Create test fixtures for each role
- Run full request-response cycle
- **Pros**: Tests real behavior, catches integration issues
- **Cons**: Slower, requires database setup/teardown

#### Approach 2: Unit Tests with Full Mocking
- Mock all database calls at a lower level
- Test permission logic in isolation
- **Pros**: Fast, isolated
- **Cons**: May miss integration issues

#### Approach 3: Hybrid Approach (Current)
- Simple permission denials use set_user fixture
- Complex workflows use integration tests with real DB
- **Pros**: Balance of speed and coverage
- **Cons**: Requires maintaining both approaches

## Test File Organization

```
tests/
├── test_role_uni_admin.py      # Uni admin specific tests
├── test_role_professor.py      # Professor specific tests
├── test_role_student.py        # Student specific tests
├── test_role_based_editor.py   # Role information in auth tokens
├── conftest.py                 # Shared fixtures (set_user, client)
└── test_utils.py               # Test utilities (DummyUser, etc.)
```

## Priority Test Scenarios

### Critical (Must Have)
1. ✅ Users cannot perform actions outside their permissions
2. ✅ File uploads work for all authenticated users
3. ⏳ Students see only published lectures in assigned subjects
4. ⏳ Professors can manage lectures in assigned subjects only
5. ⏳ Admins are restricted to their assigned university

### Important (Should Have)
6. ⏳ Role information correctly reflected in JWT tokens
7. ⏳ Permission checks at every CRUD endpoint
8. ⏳ Cross-university isolation (admin of uni1 cannot access uni2)

### Nice to Have (Could Have)
9. ⏳ Audit logging of role-based actions
10. ⏳ Performance testing with large datasets per role
11. ⏳ Concurrent access by different roles

## Next Steps

### Short Term
1. **Fix mocking or convert to integration tests**: Choose one approach and implement consistently
2. **Add real test data fixtures**: Create realistic university/faculty/subject/user hierarchies
3. **Implement E2E test runner**: Script to setup/teardown test database

### Medium Term
4. **Add test coverage reporting per role**: Track coverage by role type
5. **Create test data generators**: Factory pattern for creating test entities
6. **Add performance benchmarks**: Measure response times by role

### Long Term
7. **Implement property-based testing**: Use Hypothesis to generate test scenarios
8. **Add mutation testing**: Verify tests catch permission bugs
9. **Create visual permission matrix**: Interactive tool to verify permissions

## Running Role-Based Tests

```bash
# All role tests
pytest tests/test_role_*.py -v

# Specific role
pytest tests/test_role_professor.py -v

# Only passing tests (simple permission checks)
pytest tests/test_role_*.py -k "cannot_create" -v

# Skip failing mocked tests
pytest tests/test_role_*.py -v --ignore-glob="*_admin.py" --ignore-glob="*_professor.py::test_professor_can*"
```

## Test Maintenance

- **When adding new endpoint**: Add tests for all 4 roles (root, admin, prof, student)
- **When changing permissions**: Update permission matrix and corresponding tests
- **When refactoring**: Ensure existing role tests still pass
- **Before deployment**: Run full role test suite

## Related Documentation

- [Backend Architecture](../epistula/backend/ARCHITECTURE.md)
- [Development Guide](../DEV_GUIDE.md)
- [User Guide](../USER_GUIDE.md)
