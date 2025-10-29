# Epistula Database Architecture - Visual Reference

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EPISTULA PLATFORM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐     │
│  │   Frontend   │      │   Backend    │      │  Database    │     │
│  │   Next.js    │─────▶│   FastAPI    │─────▶│ PostgreSQL   │     │
│  │  (Port 3000) │      │  (Port 8000) │      │  (Port 5432) │     │
│  └──────────────┘      └──────────────┘      └──────────────┘     │
│       ▲                      │                       │              │
│       │                      │                       │              │
│       └──────── CORS ────────┘                       │              │
│                                                      │              │
│                                          ┌───────────▼──────────┐   │
│                                          │  Persistent Volume   │   │
│                                          │  epistula_db_data    │   │
│                                          └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database: epistula                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        PUBLIC SCHEMA                             │  │
│  │                      (Global Data)                               │  │
│  ├─────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  ┌─────────────┐      ┌──────────────────┐                     │  │
│  │  │   users     │      │  universities    │                     │  │
│  │  ├─────────────┤      ├──────────────────┤                     │  │
│  │  │ id          │◀────┐│ id               │                     │  │
│  │  │ email       │     ││ name             │                     │  │
│  │  │ password    │     ││ code             │                     │  │
│  │  │ name        │     ││ schema_name ────┼────┐                 │  │
│  │  │ is_root     │     ││ created_by      │    │                 │  │
│  │  └─────────────┘     │└──────────────────┘    │                 │  │
│  │         ▲            │         ▲              │                 │  │
│  │         │            │         │              │                 │  │
│  │  ┌──────┴──────────────────────┴───────┐      │                 │  │
│  │  │  user_university_roles              │      │                 │  │
│  │  ├─────────────────────────────────────┤      │                 │  │
│  │  │ id                                  │      │                 │  │
│  │  │ user_id (FK → users)                │      │                 │  │
│  │  │ university_id (FK → universities)   │      │                 │  │
│  │  │ role (enum)                         │      │                 │  │
│  │  │ faculty_id (FK → {schema}.faculties)│      │                 │  │
│  │  └─────────────────────────────────────┘      │                 │  │
│  │                                                │                 │  │
│  │  ┌─────────────────────────────────────┐      │                 │  │
│  │  │  audit_log                          │      │                 │  │
│  │  ├─────────────────────────────────────┤      │                 │  │
│  │  │ id                                  │      │                 │  │
│  │  │ user_id                             │      │                 │  │
│  │  │ university_id                       │      │                 │  │
│  │  │ action                              │      │                 │  │
│  │  │ old_values (JSONB)                  │      │                 │  │
│  │  │ new_values (JSONB)                  │      │                 │  │
│  │  └─────────────────────────────────────┘      │                 │  │
│  └────────────────────────────────────────────────┼─────────────────┘  │
│                                                   │                    │
│  ┌────────────────────────────────────────────────┼─────────────────┐  │
│  │                    UNI_1 SCHEMA                │                 │  │
│  │              (MIT - Example University)        │                 │  │
│  ├────────────────────────────────────────────────┼─────────────────┤  │
│  │                                                │                 │  │
│  │  ┌────────────────┐                            │                 │  │
│  │  │  faculties     │                            │                 │  │
│  │  ├────────────────┤                            │                 │  │
│  │  │ id             │                            │                 │  │
│  │  │ name           │  "Computer Science"        │                 │  │
│  │  │ code           │  "CS"                      │                 │  │
│  │  │ created_by ────┼──────────────────┐         │                 │  │
│  │  └────────────────┘                  │         │                 │  │
│  │         │                            │         │                 │  │
│  │         │ 1                           │         │                 │  │
│  │         │                            │         │                 │  │
│  │         │ N                           │         │                 │  │
│  │  ┌──────▼──────────┐                  │         │                 │  │
│  │  │  subjects       │                  │         │                 │  │
│  │  ├─────────────────┤                  │         │                 │  │
│  │  │ id              │                  │         │                 │  │
│  │  │ faculty_id      │                  │         │                 │  │
│  │  │ name            │  "Algorithms"    │         │                 │  │
│  │  │ code            │  "CS101"         │         │                 │  │
│  │  │ created_by ─────┼──────────────────┤         │                 │  │
│  │  └─────────────────┘                  │         │                 │  │
│  │         │                             │         │                 │  │
│  │         ├────────────┬─────────────┐  │         │                 │  │
│  │         │ 1          │ N           │ 1│         │                 │  │
│  │         │            │             │  │         │                 │  │
│  │  ┌──────▼──────┐  ┌──▼────────┐  ┌───▼─────┐   │                 │  │
│  │  │  lectures   │  │  subject_ │  │ subject_│   │                 │  │
│  │  ├─────────────┤  │professors │  │students │   │                 │  │
│  │  │ id          │  ├───────────┤  ├─────────┤   │                 │  │
│  │  │ subject_id  │  │ subject_id│  │subject_ │   │                 │  │
│  │  │ title       │  │ professor_│  │ student_│   │                 │  │
│  │  │ order_num   │  │     id ───┼──┼──  id ──┼───┘                 │  │
│  │  │ is_published│  │ can_edit  │  │ status  │                     │  │
│  │  └─────────────┘  └───────────┘  └─────────┘                     │  │
│  │         │ 1                                                       │  │
│  │         │ N                                                       │  │
│  │  ┌──────▼────────────┐                                            │  │
│  │  │  lecture_content  │                                            │  │
│  │  ├───────────────────┤                                            │  │
│  │  │ id                │                                            │  │
│  │  │ lecture_id        │                                            │  │
│  │  │ content_type      │  (markdown, video, pdf...)                │  │
│  │  │ content           │  (text/reference)                          │  │
│  │  │ version           │  (1, 2, 3...)                              │  │
│  │  └───────────────────┘                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    UNI_2 SCHEMA                                  │  │
│  │              (Harvard - Example University)                      │  │
│  ├─────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  (Same structure as UNI_1)                                       │  │
│  │  - faculties                                                     │  │
│  │  - subjects                                                      │  │
│  │  - lectures                                                      │  │
│  │  - lecture_content                                               │  │
│  │  - subject_professors                                            │  │
│  │  - subject_students                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ... (more university schemas as needed)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## User Role Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                       ROOT USER                          │
│                    (Global Admin)                        │
├──────────────────────────────────────────────────────────┤
│ - Create universities                                    │
│ - Create any user with any role                          │
│ - Access all data across all schemas                     │
│ - Only one root user allowed                             │
│ - Login restricted to localhost                          │
└──────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────────┐ ┌────────────┐ ┌────────────┐
│   UNI_ADMIN     │ │ UNI_ADMIN  │ │ UNI_ADMIN  │
│   (MIT)         │ │ (Harvard)  │ │ (Stanford) │
├─────────────────┤ ├────────────┤ ├────────────┤
│ - Scoped to MIT │ │ - Scoped   │ │ - Scoped   │
│ - Create users  │ │   to uni   │ │   to uni   │
│ - Manage        │ │ - Create   │ │ - Create   │
│   faculties     │ │   users    │ │   users    │
│ - Assign        │ │ - Manage   │ │ - Manage   │
│   professors    │ │   data     │ │   data     │
└─────────────────┘ └────────────┘ └────────────┘
          │               │               │
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────┐
│              PROFESSORS                          │
├─────────────────────────────────────────────────┤
│ - Can teach at MULTIPLE universities            │
│ - Create subjects (where assigned)              │
│ - Edit subjects (with edit rights)              │
│ - Create/edit lectures in their subjects        │
│                                                  │
│ Example: Prof. Smith                             │
│   - Professor at MIT (CS faculty)                │
│   - Professor at Harvard (Engineering faculty)   │
│   - Teaches: CS101 (MIT), ENG202 (Harvard)       │
└─────────────────────────────────────────────────┘
          │
          │
          ▼
┌─────────────────────────────────────────────────┐
│                STUDENTS                          │
├─────────────────────────────────────────────────┤
│ - Belongs to ONE faculty                        │
│ - Can enroll in subjects from different         │
│   faculties (within same university)            │
│ - Read-only access to enrolled subjects         │
│ - Cannot see un-enrolled subjects                │
│                                                  │
│ Example: Student Jane                            │
│   - Home faculty: CS (MIT)                       │
│   - Enrolled in:                                 │
│     • CS101 (CS faculty)                         │
│     • MATH201 (Math faculty)                     │
│     • PHY101 (Physics faculty)                   │
└─────────────────────────────────────────────────┘
```

## Data Flow - Student Accessing Lecture

```
┌──────────────┐
│   Student    │  "I want to view Lecture 5 in CS101"
│   (Jane)     │
└──────┬───────┘
       │
       │ 1. HTTP GET /lectures/5
       │    Authorization: Bearer <JWT>
       ▼
┌──────────────┐
│   Backend    │
│   FastAPI    │
└──────┬───────┘
       │
       │ 2. Decode JWT, get user_id
       │
       ▼
┌────────────────────────────────────────┐
│        public.users                    │
│  Get user info by id                   │
└────────────────────────────────────────┘
       │
       │ 3. Get user's university & role
       │
       ▼
┌────────────────────────────────────────┐
│   public.user_university_roles         │
│   - user_id = Jane                     │
│   - university_id = 1 (MIT)            │
│   - role = 'student'                   │
└────────────────────────────────────────┘
       │
       │ 4. Get university schema
       │
       ▼
┌────────────────────────────────────────┐
│   public.universities                  │
│   id=1 → schema_name='uni_1'           │
└────────────────────────────────────────┘
       │
       │ 5. SET search_path TO uni_1, public
       │
       ▼
┌────────────────────────────────────────┐
│   uni_1.lectures                       │
│   Get lecture with id=5                │
│   - subject_id = 1                     │
└────────────────────────────────────────┘
       │
       │ 6. Check enrollment
       │
       ▼
┌────────────────────────────────────────┐
│   uni_1.subject_students               │
│   WHERE subject_id=1 AND student_id=Jane│
│   → Found! Student is enrolled          │
└────────────────────────────────────────┘
       │
       │ 7. Check if published
       │
       ▼
┌────────────────────────────────────────┐
│   uni_1.lectures                       │
│   WHERE id=5 AND is_published=TRUE     │
│   → Yes, lecture is published           │
└────────────────────────────────────────┘
       │
       │ 8. Get lecture content
       │
       ▼
┌────────────────────────────────────────┐
│   uni_1.lecture_content                │
│   WHERE lecture_id=5                   │
│   → Return latest version               │
└────────────────────────────────────────┘
       │
       │ 9. Return lecture data
       │
       ▼
┌──────────────┐
│   Student    │  Receives lecture content
│   (Jane)     │
└──────────────┘
```

## Backup Isolation Example

```
Full Backup Strategy
══════════════════════════════════════════════════

Daily: Backup ALL schemas
┌─────────────────────────────────────────┐
│ pg_dump -U user epistula                │
│ → backup_full_2024-10-29.sql            │
│   Size: ~500MB                          │
└─────────────────────────────────────────┘

Per-University: Backup individual schemas
┌─────────────────────────────────────────┐
│ pg_dump -U user -n uni_1 epistula       │
│ → backup_mit_2024-10-29.sql             │
│   Size: ~50MB                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ pg_dump -U user -n uni_2 epistula       │
│ → backup_harvard_2024-10-29.sql         │
│   Size: ~45MB                           │
└─────────────────────────────────────────┘

Restore Scenario: MIT data corrupted
══════════════════════════════════════════

1. Drop corrupted schema
   DROP SCHEMA uni_1 CASCADE;

2. Restore only MIT schema
   psql -U user -d epistula < backup_mit_2024-10-28.sql

✅ Harvard (uni_2) and Stanford (uni_3) UNAFFECTED
✅ Minimal downtime (only MIT users affected)
✅ Smaller backup file to transfer/restore
```

## Request Flow - Creating a Subject

```
┌──────────────┐
│ Uni-Admin    │  "Create new subject CS102"
│   (Bob)      │
└──────┬───────┘
       │
       │ POST /universities/1/subjects
       │ { name: "Data Structures", code: "CS102",
       │   faculty_id: 1 }
       │
       ▼
┌────────────────────────────────────────┐
│  Backend: Verify Bob is uni-admin at   │
│  university_id=1                       │
└────────────────────────────────────────┘
       │
       │ Query: user_university_roles
       │ WHERE user_id=Bob AND university_id=1
       │       AND role='uni_admin'
       │ → AUTHORIZED
       │
       ▼
┌────────────────────────────────────────┐
│  Get university schema                 │
│  universities WHERE id=1               │
│  → schema_name = 'uni_1'               │
└────────────────────────────────────────┘
       │
       │ SET search_path TO uni_1, public
       │
       ▼
┌────────────────────────────────────────┐
│  Verify faculty exists                 │
│  uni_1.faculties WHERE id=1            │
│  → Found: "Computer Science"           │
└────────────────────────────────────────┘
       │
       │
       ▼
┌────────────────────────────────────────┐
│  Insert new subject                    │
│  INSERT INTO uni_1.subjects            │
│  (faculty_id, name, code, created_by)  │
│  VALUES (1, "Data Structures",         │
│          "CS102", Bob)                 │
└────────────────────────────────────────┘
       │
       │
       ▼
┌────────────────────────────────────────┐
│  Log to audit trail                    │
│  INSERT INTO public.audit_log          │
│  (user_id, university_id, action,      │
│   table_name, new_values)              │
└────────────────────────────────────────┘
       │
       │ 201 Created
       │ { id: 42, name: "Data Structures",
       │   code: "CS102", ... }
       │
       ▼
┌──────────────┐
│ Uni-Admin    │  Subject created!
│   (Bob)      │
└──────────────┘
```

## Legend

```
Symbols:
  │     Relationship/Flow
  ▼     Direction of flow
  ◀──   Foreign key reference
  ═══   Section divider
  
Cardinality:
  1     One
  N     Many (zero or more)
  
Abbreviations:
  FK    Foreign Key
  PK    Primary Key
  JSONB JSON Binary (PostgreSQL type)
```

---

This visual reference complements the detailed documentation in `DATABASE_DESIGN.md` and `DATABASE_README.md`.
