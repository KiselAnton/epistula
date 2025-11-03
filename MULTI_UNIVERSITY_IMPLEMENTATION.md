# Multi-University Access Implementation Plan

## Overview
Enable users to select which university to access when they have roles in multiple institutions.

## Current State
- ✅ Backend supports multiple universities per user (`user_university_roles` table)
- ✅ User model has `universities: List[int]` and `primary_university_id` fields
- ⚠️ Frontend only uses first university as primary, no selection UI
- ⚠️ No way to switch universities after login

## Implementation Phases

### Phase 1: Backend Enhancements

#### 1.1 Return Full University Details in Login Response
**File:** `epistula/backend/middleware/auth.py`

```python
def db_user_to_pydantic(db_user: UserDB, db: Session = None) -> User:
    # ... existing code ...
    
    # Fetch university details with roles
    university_access = []
    if db:
        user_roles = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == db_user.id
        ).all()
        
        if user_roles:
            # Get university details for active, non-temp universities
            from sqlalchemy import text
            for ur in user_roles:
                uni_query = text("""
                    SELECT id, name, code, schema_name, is_active, logo_url
                    FROM public.universities
                    WHERE id = :uni_id
                    AND is_active = TRUE
                    AND schema_name NOT LIKE '%_temp'
                """)
                result = db.execute(uni_query, {"uni_id": ur.university_id}).fetchone()
                if result:
                    university_access.append({
                        "university_id": result[0],
                        "university_name": result[1],
                        "university_code": result[2],
                        "role": ur.role,
                        "is_active": ur.is_active  # user's active status in this uni
                    })
    
    # Filter to active user roles only
    active_universities = [
        ua for ua in university_access 
        if ua.get("is_active", True)
    ]
    
    return User(
        # ... existing fields ...
        universities=[ua["university_id"] for ua in active_universities],
        university_access=active_universities,  # New field
        primary_university_id=active_universities[0]["university_id"] if active_universities else None,
    )
```

**Changes to `utils/models.py`:**
```python
class UniversityAccess(BaseModel):
    """University access info for a user"""
    university_id: int
    university_name: str
    university_code: str
    role: UserRole
    is_active: bool = True

class User(UserBase):
    """Complete user model"""
    id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    universities: List[int] = []  # Legacy field
    university_access: List[UniversityAccess] = []  # NEW: Detailed access info
    primary_university_id: Optional[int] = None
```

### Phase 2: Frontend University Selector

#### 2.1 Create University Selector Page
**File:** `epistula/frontend/pages/select-university.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/UniversitySelector.module.css';

interface UniversityAccess {
  university_id: number;
  university_name: string;
  university_code: string;
  role: string;
  is_active: boolean;
}

export default function SelectUniversity() {
  const router = useRouter();
  const [universities, setUniversities] = useState<UniversityAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }

    try {
      const userData = JSON.parse(user);
      const universityAccess = userData.university_access || [];

      if (universityAccess.length === 0) {
        // No university access, go to dashboard
        router.push('/dashboard');
        return;
      }

      if (universityAccess.length === 1) {
        // Only one university, redirect directly
        router.push(`/university/${universityAccess[0].university_id}`);
        return;
      }

      // Multiple universities - show selector
      setUniversities(universityAccess);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleSelectUniversity = (universityId: number) => {
    // Store selected university in localStorage for quick access
    localStorage.setItem('selected_university_id', String(universityId));
    router.push(`/university/${universityId}`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Select University - Epistula</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>Select University</h1>
          <p className={styles.subtitle}>
            You have access to multiple universities. Please select one to continue:
          </p>
          <div className={styles.universityList}>
            {universities.map((uni) => (
              <button
                key={uni.university_id}
                className={styles.universityCard}
                onClick={() => handleSelectUniversity(uni.university_id)}
              >
                <div className={styles.universityHeader}>
                  <h2>{uni.university_name}</h2>
                  <span className={styles.badge}>{uni.role}</span>
                </div>
                <p className={styles.code}>Code: {uni.university_code}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
```

#### 2.2 Update Login Redirect Logic
**File:** `epistula/frontend/pages/index.tsx`

```typescript
// After successful login:
if (data.user) {
  localStorage.setItem('user', JSON.stringify(data.user));
  
  const universityAccess = data.user.university_access || [];
  
  // Root users go to dashboard
  if (data.user.role === 'root') {
    window.location.href = '/dashboard';
  }
  // Single university - redirect directly
  else if (universityAccess.length === 1) {
    window.location.href = `/university/${universityAccess[0].university_id}`;
  }
  // Multiple universities - show selector
  else if (universityAccess.length > 1) {
    window.location.href = '/select-university';
  }
  // No universities - go to dashboard (edge case)
  else {
    window.location.href = '/dashboard';
  }
}
```

#### 2.3 Add University Switcher to Layout
**File:** `epistula/frontend/components/layout/MainLayout.tsx`

Add a "Switch University" button in the header when user has multiple universities:

```typescript
const UniversitySwitcher = () => {
  const [universities, setUniversities] = useState<UniversityAccess[]>([]);
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUniversities(userData.university_access || []);
    }
  }, []);

  if (universities.length <= 1) return null;

  return (
    <button
      onClick={() => router.push('/select-university')}
      className={styles.switchUniversityBtn}
      title="Switch University"
    >
      🔄 Switch University
    </button>
  );
};
```

### Phase 3: Styling

**File:** `epistula/frontend/styles/UniversitySelector.module.css`

```css
.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
}

.card h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: #333;
}

.subtitle {
  color: #666;
  margin-bottom: 2rem;
}

.universityList {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.universityCard {
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.universityCard:hover {
  border-color: #667eea;
  background: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.universityHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.universityHeader h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.badge {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.code {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}
```

## Migration Strategy

### Step 1: Backend Update (Non-Breaking)
1. Add `UniversityAccess` model to `utils/models.py`
2. Update `db_user_to_pydantic()` to include `university_access` field
3. Existing clients continue working (they ignore new field)

### Step 2: Frontend Update
1. Create `select-university.tsx` page
2. Create `UniversitySelector.module.css` styles
3. Update login redirect logic in `index.tsx`
4. Add university switcher to `MainLayout.tsx`

### Step 3: Testing
1. Test root user (should go to dashboard directly)
2. Test user with one university (should skip selector)
3. Test user with multiple universities (should see selector)
4. Test user with no universities (should go to dashboard)
5. Test university switcher button visibility
6. Test temp university filtering

## Edge Cases to Handle

1. **All universities inactive:** Show message, logout button
2. **User deactivated in all universities:** Show error, logout
3. **Only temp universities:** Filter them out, show "no access"
4. **Concurrent session:** Handle localStorage updates
5. **University deleted:** Handle 404 gracefully

## Database Query Impact

**Before:**
- Login: 2 queries (user lookup, user_university_roles)

**After:**
- Login: 3 queries (user lookup, user_university_roles, university details)
- Impact: +1 query, minimal performance impact (still <50ms)

## Security Considerations

✅ **No security risks:**
- Users only see universities they have access to
- Backend already validates university access per endpoint
- JWT token doesn't change (still user-scoped, not university-scoped)
- University switching is client-side navigation (no re-authentication)

## Rollback Plan

If issues arise:
1. Revert frontend changes (remove selector page)
2. Revert login redirect logic (use primary_university_id)
3. Backend changes are backward-compatible (can stay)

## Timeline Estimate

- **Backend changes:** 1-2 hours
- **Frontend selector page:** 2-3 hours
- **Styling & UX polish:** 1-2 hours
- **Testing & bug fixes:** 2-3 hours
- **Total:** 6-10 hours of development

## Recommendation

✅ **IMPLEMENT IT**

**Reasons:**
1. Data model already supports it (90% done)
2. Natural UX for multi-institution users
3. Low risk (backward compatible)
4. Future-proof (scalable to N universities)
5. Professional feature (common in education systems)

**Quick Win Version:**
- Skip university switcher in header (Phase 3.3)
- Just implement selector page on login
- Users can always logout and login again to switch
- Add switcher later if needed

Would you like me to implement this? I can start with the backend changes and selector page.
