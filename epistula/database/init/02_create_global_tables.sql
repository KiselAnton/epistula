-- ============================================================================
-- Epistula Database Initialization
-- Part 2: Create Global Tables (public schema)
-- ============================================================================

-- Users table (global - all users across all universities)
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    is_root BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_active ON public.users(is_active);
CREATE INDEX idx_users_root ON public.users(is_root) WHERE is_root = TRUE;

COMMENT ON TABLE public.users IS 'Central user registry for all users across all universities';
COMMENT ON COLUMN public.users.is_root IS 'Super administrator flag - only one root user should exist';

-- Universities table (global registry)
CREATE TABLE public.universities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    schema_name VARCHAR(63) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT schema_name_format CHECK (schema_name ~ '^uni_[0-9]+$'),
    CONSTRAINT code_uppercase CHECK (code = UPPER(code))
);

CREATE INDEX idx_universities_code ON public.universities(code);
CREATE INDEX idx_universities_schema ON public.universities(schema_name);
CREATE INDEX idx_universities_active ON public.universities(is_active);

COMMENT ON TABLE public.universities IS 'Registry of all universities in the system';
COMMENT ON COLUMN public.universities.schema_name IS 'PostgreSQL schema name for this university (e.g., uni_1)';

-- User-University-Role mapping
CREATE TABLE public.user_university_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    university_id INTEGER NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    faculty_id INTEGER,  -- References {schema}.faculties(id) - NULL for non-students
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT unique_user_uni_role UNIQUE(user_id, university_id, role),
    CONSTRAINT student_must_have_faculty CHECK (
        (role != 'student') OR (faculty_id IS NOT NULL)
    )
);

CREATE INDEX idx_user_uni_roles_user ON public.user_university_roles(user_id);
CREATE INDEX idx_user_uni_roles_uni ON public.user_university_roles(university_id);
CREATE INDEX idx_user_uni_roles_role ON public.user_university_roles(role);
CREATE INDEX idx_user_uni_roles_active ON public.user_university_roles(is_active);

COMMENT ON TABLE public.user_university_roles IS 'Maps users to universities with specific roles';
COMMENT ON COLUMN public.user_university_roles.faculty_id IS 'For students: their home faculty (validated via trigger)';

-- Audit log table (global)
CREATE TABLE public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    university_id INTEGER REFERENCES public.universities(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_university ON public.audit_log(university_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

COMMENT ON TABLE public.audit_log IS 'Global audit trail for all user actions';

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row modification';
