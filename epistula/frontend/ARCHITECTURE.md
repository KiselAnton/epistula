# Frontend Architecture

This document describes the refactored frontend architecture for better maintainability and code reusability.

## Directory Structure

```
frontend/
├── components/
│   ├── common/           # Reusable UI components
│   │   ├── Modal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── EntityCard.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Pagination.tsx
│   │   └── index.ts
│   └── layout/           # Layout components
│       └── MainLayout.tsx
├── hooks/                # Custom React hooks
│   └── useData.ts        # Data fetching hooks
├── pages/                # Next.js pages
│   ├── university/       # University-related pages
│   │   └── [id]/
│   │       ├── faculties.tsx
│   │       └── faculty/
│   │           └── [facultyId]/
│   │               ├── subjects.tsx
│   │               └── subject/
│   │                   └── [subjectId].tsx
│   ├── universities.tsx
│   └── dashboard.tsx
├── styles/               # CSS modules
│   ├── Modal.module.css
│   ├── Faculties.module.css
│   └── Layout.module.css
├── types/                # TypeScript type definitions
│   └── index.ts          # Shared interfaces
└── utils/                # Utility functions
    ├── api.ts            # Core API utilities
    ├── universities.api.ts
    ├── faculties.api.ts
    └── subjects.api.ts
```

## Core Concepts

### 1. API Layer (`utils/*.api.ts`)

Centralized API functions for each entity:

```typescript
import { universitiesApi } from '@/utils/universities.api';

// List all universities
const universities = await universitiesApi.list();

// Create a university
const newUni = await universitiesApi.create({ name, code, description });

// Upload logo
const updated = await universitiesApi.uploadLogo(id, file);
```

**Benefits:**
- Single source of truth for API calls
- Type safety
- Easy to mock for testing
- Consistent error handling

### 2. Custom Hooks (`hooks/useData.ts`)

Reusable data fetching logic:

```typescript
import { useUniversities, useUniversity } from '@/hooks/useData';

// In a component
const { universities, loading, error, refetch } = useUniversities();
const { university } = useUniversity(id);
```

**Benefits:**
- Encapsulates loading/error states
- Automatic refetching
- Reduces boilerplate in components

### 3. Reusable Components (`components/common/`)

**Modal:**
```typescript
<Modal isOpen={isOpen} onClose={onClose} title="Create Entity">
  {/* Your form here */}
</Modal>
```

**ConfirmDialog:**
```typescript
<ConfirmDialog
  isOpen={isOpen}
  onClose={onClose}
  onConfirm={handleDelete}
  title="Confirm Deletion"
  message="Are you sure?"
  warning={true}
/>
```

**EntityCard:**
```typescript
<EntityCard
  title="Faculty Name"
  subtitle="FAC"
  description="Description..."
  logoUrl="/storage/logo.png"
  icon="🎓"
  onClick={() => router.push('/faculty/1')}
/>
```

**EmptyState:**
```typescript
<EmptyState
  icon="📚"
  title="No subjects yet"
  description="Create your first subject"
  actionButton={{ text: "Create Subject", onClick: handleCreate }}
/>
```

**Pagination:**
```typescript
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
/>
```

### 4. Type Safety (`types/index.ts`)

Shared TypeScript interfaces:

```typescript
import { University, Faculty, Subject } from '@/types';
```

## Migration Guide

### Before (Monolithic):
```typescript
// Duplicated code in every component
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${url}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // ... 20 more lines of boilerplate
  } catch (err) {
    setError(err.message);
  }
};
```

### After (Modular):
```typescript
import { useUniversities } from '@/hooks/useData';
import { EntityCard, EmptyState } from '@/components/common';

const { universities, loading, error } = useUniversities();
```

## Best Practices

1. **Always use API utilities** instead of raw fetch calls
2. **Use custom hooks** for data fetching to avoid prop drilling
3. **Use reusable components** instead of duplicating UI code
4. **Import types** from `types/index.ts`
5. **Keep components small** - extract logic to hooks
6. **Use Modal for dialogs** instead of inline overlays

## Next Steps

1. Refactor existing pages to use new utilities
2. Add more reusable components (Forms, Buttons, etc.)
3. Add unit tests for utilities and hooks
4. Add Storybook for component documentation
