# Epistula Code Style Guide

## Overview

This document defines the strict code standards for the Epistula project. All contributors must adhere to these guidelines to ensure code quality, consistency, and maintainability.

## Python Version

- **Required**: Python 3.14+
- All code must be compatible with Python 3.14 and later versions
- Use modern Python features and type hints where applicable

## Dependency Management

- **Package Manager**: pip
- Use `requirements.txt` for production dependencies
- Use `requirements-dev.txt` for development dependencies
- Pin exact versions in production (`package==1.2.3`)
- Document why specific versions are required if pinned

## Code Quality & Linting

### Flake8

- **Required**: All code must pass flake8 linting
- Configuration: See `.flake8` file in repository root
- Maximum line length: 100 characters
- Run before committing: `flake8 .`

### Code Style

- Follow PEP 8 conventions
- Use 4 spaces for indentation (no tabs)
- Two blank lines between top-level definitions
- One blank line between method definitions
- Imports should be grouped: standard library, third-party, local

## Documentation

### Docstrings

- **Required**: All public modules, classes, functions, and methods must have docstrings
- **Format**: Use Google-style docstrings
- **Minimum content**:
  - Brief description (one line)
  - Args: Document all parameters with types
  - Returns: Document return value and type
  - Raises: Document exceptions that may be raised

**Example**:

```python
def process_message(message: str, priority: int = 1) -> bool:
    """Process an incoming message with specified priority.
    
    Args:
        message (str): The message content to process.
        priority (int): Priority level (1-5). Defaults to 1.
    
    Returns:
        bool: True if processing succeeded, False otherwise.
    
    Raises:
        ValueError: If priority is outside 1-5 range.
    """
    if not 1 <= priority <= 5:
        raise ValueError(f"Priority must be 1-5, got {priority}")
    # Processing logic here
    return True
```

## Git Workflow

### Branching Strategy

- **Main branch**: `master` (protected)
- **Feature branches**: `feature/<description>` or `feature/<issue-number>-<description>`
- **Bug fixes**: `fix/<description>` or `fix/<issue-number>-<description>`
- **Documentation**: `docs/<description>`
- Never commit directly to `master`

### Commit Messages

- **Required**: Follow Conventional Commits specification
- **Format**: `<type>(<scope>): <description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependencies
- `ci`: CI/CD configuration changes

**Examples**:
```
feat(auth): add OAuth2 authentication support
fix(email): resolve SMTP timeout issue
docs: update installation instructions
test(parser): add unit tests for XML parsing
ci: add flake8 linting to GitHub Actions
```

### Pull Request Requirements

- **Minimum reviewers**: 1 (required)
- **CI checks**: Must pass all automated checks before merge
  - Linting (flake8)
  - Tests (pytest or unittest)
- **Description**: Include clear description of changes
- **Link issues**: Reference related issues with `#issue-number`
- **Review**: Address all review comments before merge

## Continuous Integration

### Required CI Checks

All pull requests must pass:

1. **Linting Check**: `flake8 .` must pass with zero errors
2. **Test Suite**: All tests must pass
3. **Coverage**: Maintain or improve test coverage

### GitHub Actions Workflow

The repository includes a GitHub Actions workflow (`.github/workflows/lint-test.yml`) that automatically:

- Runs flake8 on all Python files
- Executes the full test suite
- Reports results on pull requests
- Blocks merge if checks fail

## Testing

- Write tests for all new features
- Maintain test coverage above 70%
- Use descriptive test names: `test_<function>_<scenario>_<expected>`
- Place tests in `tests/` directory

## Type Hints

- Use type hints for function signatures
- Use `typing` module for complex types
- Example: `from typing import List, Dict, Optional`

## Enforcement

These standards are enforced through:

1. **Automated CI**: Linting and tests run on every PR
2. **Code review**: Minimum 1 reviewer checks compliance
3. **Branch protection**: `master` requires passing checks and review

## Tools Setup

### Installation

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Install pre-commit hooks (recommended)
pip install pre-commit
pre-commit install
```

### Pre-commit Checks

```bash
# Run flake8
flake8 .

# Run tests
python -m pytest

# Run both
flake8 . && python -m pytest
```

## Questions?

If you have questions about these standards, please:

1. Check existing code for examples
2. Ask in pull request comments
3. Open an issue for clarification

---

**Last Updated**: October 2025
**Applies to**: Epistula v1.0.0+
