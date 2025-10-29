# Epistula Database Design

## Overview

The Epistula platform uses PostgreSQL with a **multi-schema architecture** where each university gets its own schema. This allows for:
- Independent backups per university
- Schema-level access control
- Easier data migration and restoration
- Logical separation of university data

## Architecture

### Container Setup
- **Database Container**: PostgreSQL (persistent, not rebuilt on app updates)
- **Backend Container**: FastAPI application (stateless, can be rebuilt)
- **Frontend Container**: Next.js application (stateless, can be rebuilt)

### Schema Strategy

```
PostgreSQL Database: epistula
├── Schema: public (global data)
│   ├── users (all users across all universities)
│   ├── universities
│   └── user_university_roles (role assignments per university)
│
├── Schema: uni_<university_id> (e.g., uni_1, uni_2)
│   ├── faculties
│   ├── subjects
│   ├── lectures
│   ├── subject_professors (teaching assignments)
│   ├── subject_students (enrollment)
│   └── lecture_content
└── ...
```

## Data Model

### Global Schema (`public`)

#### Table: `users`
Central user registry for all users in the system.

```sql
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    is_root BOOLEAN DEFAULT FALSE  -- Only one root user allowed
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_active ON public.users(is_active);
```

#### Table: `universities`
```sql
CREATE TABLE public.universities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,  -- e.g., "MIT", "HARVARD"
    schema_name VARCHAR(63) NOT NULL UNIQUE,  -- e.g., "uni_1", "uni_2"
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_universities_code ON public.universities(code);
CREATE INDEX idx_universities_schema ON public.universities(schema_name);
```

#### Table: `user_university_roles`
Maps users to universities with specific roles.

```sql
CREATE TYPE user_role AS ENUM ('root', 'uni_admin', 'professor', 'student');

CREATE TABLE public.user_university_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    university_id INTEGER NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    faculty_id INTEGER,  -- For students (which faculty they belong to)
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id),
    
    UNIQUE(user_id, university_id, role)
);

CREATE INDEX idx_user_uni_roles_user ON public.user_university_roles(user_id);
CREATE INDEX idx_user_uni_roles_uni ON public.user_university_roles(university_id);
CREATE INDEX idx_user_uni_roles_role ON public.user_university_roles(role);
```

### University Schema (`uni_<id>`)

Each university gets its own schema with the following tables:

#### Table: `faculties`
```sql
CREATE TABLE {schema}.faculties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(code)
);

CREATE INDEX idx_{schema}_faculties_code ON {schema}.faculties(code);
```

#### Table: `subjects`
```sql
CREATE TABLE {schema}.subjects (
    id SERIAL PRIMARY KEY,
    faculty_id INTEGER NOT NULL REFERENCES {schema}.faculties(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(code)
);

CREATE INDEX idx_{schema}_subjects_faculty ON {schema}.subjects(faculty_id);
CREATE INDEX idx_{schema}_subjects_code ON {schema}.subjects(code);
```

#### Table: `subject_professors`
Professors who can edit a subject (many-to-many).

```sql
CREATE TABLE {schema}.subject_professors (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES {schema}.subjects(id) ON DELETE CASCADE,
    professor_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    assigned_by INTEGER REFERENCES public.users(id),
    
    UNIQUE(subject_id, professor_id)
);

CREATE INDEX idx_{schema}_subject_profs_subject ON {schema}.subject_professors(subject_id);
CREATE INDEX idx_{schema}_subject_profs_prof ON {schema}.subject_professors(professor_id);
```

#### Table: `lectures`
```sql
CREATE TABLE {schema}.lectures (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES {schema}.subjects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_published BOOLEAN DEFAULT FALSE,
    
    UNIQUE(subject_id, order_number)
);

CREATE INDEX idx_{schema}_lectures_subject ON {schema}.lectures(subject_id);
CREATE INDEX idx_{schema}_lectures_published ON {schema}.lectures(is_published);
```

#### Table: `lecture_content`
Stores the actual lecture content (markdown, media references, etc.).

```sql
CREATE TABLE {schema}.lecture_content (
    id SERIAL PRIMARY KEY,
    lecture_id INTEGER NOT NULL REFERENCES {schema}.lectures(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,  -- 'markdown', 'video', 'pdf', etc.
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id)
);

CREATE INDEX idx_{schema}_lecture_content_lecture ON {schema}.lecture_content(lecture_id);
```

#### Table: `subject_students`
Students enrolled in subjects (many-to-many).

```sql
CREATE TABLE {schema}.subject_students (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES {schema}.subjects(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    enrolled_by INTEGER REFERENCES public.users(id),
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'completed', 'dropped'
    
    UNIQUE(subject_id, student_id)
);

CREATE INDEX idx_{schema}_subject_students_subject ON {schema}.subject_students(subject_id);
CREATE INDEX idx_{schema}_subject_students_student ON {schema}.subject_students(student_id);
```

## Access Control Rules

### Root User
- Can create and manage universities
- Can create any user role in any university
- Can access all data across all schemas
- **Security**: Login restricted to local machine only

### Uni-Admin
- Created by root or another uni-admin of the same university
- Can only access their assigned university's schema
- Can create professors and students within their university
- Can manage faculties and subjects
- Cannot access other universities

### Professor
- Created by root or uni-admin
- Can teach at multiple universities (multiple `user_university_roles` entries)
- Can create subjects in universities where they have professor role
- Can edit subjects where they are assigned in `subject_professors`
- Can create/edit lectures only in subjects they have access to

### Student
- Created by anyone with appropriate permissions
- Belongs to ONE faculty (stored in `user_university_roles.faculty_id`)
- Can only read lectures from subjects they're enrolled in (`subject_students`)
- Can enroll in subjects from different faculties within same university
- Cannot see subjects they're not assigned to

## Implementation Phases

### Phase 1: Database Setup
- [ ] Create PostgreSQL container with persistent volume
- [ ] Create initial migration scripts
- [ ] Set up `public` schema with global tables
- [ ] Create schema creation function for new universities

### Phase 2: User Management
- [ ] Implement user authentication (JWT)
- [ ] Create root user initialization
- [ ] Implement role-based access control middleware
- [ ] Add user CRUD operations with role checks

### Phase 3: University & Faculty Management
- [ ] Implement university creation (creates new schema)
- [ ] Implement faculty CRUD within university schemas
- [ ] Add uni-admin management

### Phase 4: Subject & Lecture Management
- [ ] Implement subject CRUD with professor assignment
- [ ] Implement lecture CRUD with content versioning
- [ ] Add student enrollment system

### Phase 5: Advanced Features
- [ ] Add backup/restore per university schema
- [ ] Implement audit logging
- [ ] Add search functionality
- [ ] Implement notes system for students

## Database Initialization Script

```sql
-- init/01_create_database.sql
CREATE DATABASE epistula;

-- init/02_create_public_schema.sql
-- Create enum type
CREATE TYPE user_role AS ENUM ('root', 'uni_admin', 'professor', 'student');

-- Create tables (see schema definitions above)

-- init/03_create_functions.sql
-- Function to create a new university schema
CREATE OR REPLACE FUNCTION create_university_schema(schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    
    -- Create all tables in the new schema
    EXECUTE format('
        CREATE TABLE %I.faculties (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            created_by INTEGER REFERENCES public.users(id),
            is_active BOOLEAN DEFAULT TRUE,
            UNIQUE(code)
        )', schema_name);
    
    -- ... (create all other tables)
    
END;
$$ LANGUAGE plpgsql;
```

## Benefits of This Design

1. **Isolation**: Each university's data is in a separate schema, enabling independent backups
2. **Scalability**: Easy to add new universities without affecting existing data
3. **Security**: Schema-level permissions can be enforced at database level
4. **Flexibility**: Professors can teach at multiple universities
5. **Maintainability**: Clear separation between global and university-specific data
6. **Performance**: Indexes scoped to relevant data sets

## Notes

- Use SQLAlchemy with schema-aware session management
- Implement Row-Level Security (RLS) policies for additional protection
- Consider partitioning for large tables in high-volume universities
- Use connection pooling with schema-aware routing
