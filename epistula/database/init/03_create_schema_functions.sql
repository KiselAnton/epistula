-- ============================================================================
-- Epistula Database Initialization
-- Part 3: University Schema Creation Function
-- ============================================================================

-- Function to create a new university schema with all required tables
CREATE OR REPLACE FUNCTION create_university_schema(p_schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Create the schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema_name);
    
    -- ========================================================================
    -- Faculties table
    -- ========================================================================
    EXECUTE format('
        CREATE TABLE %I.faculties (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            created_by INTEGER REFERENCES public.users(id),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE,
            
            CONSTRAINT %I_faculties_code_unique UNIQUE(code),
            CONSTRAINT %I_faculties_code_uppercase CHECK (code = UPPER(code))
        )', p_schema_name, p_schema_name, p_schema_name);
    
    EXECUTE format('CREATE INDEX idx_%I_faculties_code ON %I.faculties(code)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_faculties_active ON %I.faculties(is_active)', 
        p_schema_name, p_schema_name);
    
    -- Add updated_at trigger
    EXECUTE format('
        CREATE TRIGGER update_%I_faculties_updated_at
        BEFORE UPDATE ON %I.faculties
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()', p_schema_name, p_schema_name);
    
    -- ========================================================================
    -- Subjects table
    -- ========================================================================
    EXECUTE format('
        CREATE TABLE %I.subjects (
            id SERIAL PRIMARY KEY,
            faculty_id INTEGER NOT NULL REFERENCES %I.faculties(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            created_by INTEGER REFERENCES public.users(id),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE,
            
            CONSTRAINT %I_subjects_code_unique UNIQUE(code),
            CONSTRAINT %I_subjects_code_uppercase CHECK (code = UPPER(code))
        )', p_schema_name, p_schema_name, p_schema_name, p_schema_name);
    
    EXECUTE format('CREATE INDEX idx_%I_subjects_faculty ON %I.subjects(faculty_id)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_subjects_code ON %I.subjects(code)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_subjects_active ON %I.subjects(is_active)', 
        p_schema_name, p_schema_name);
    
    -- Add updated_at trigger
    EXECUTE format('
        CREATE TRIGGER update_%I_subjects_updated_at
        BEFORE UPDATE ON %I.subjects
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()', p_schema_name, p_schema_name);
    
    -- ========================================================================
    -- Subject Professors (teaching assignments)
    -- ========================================================================
    EXECUTE format('
        CREATE TABLE %I.subject_professors (
            id SERIAL PRIMARY KEY,
            subject_id INTEGER NOT NULL REFERENCES %I.subjects(id) ON DELETE CASCADE,
            professor_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            can_edit BOOLEAN DEFAULT TRUE,
            assigned_at TIMESTAMP DEFAULT NOW(),
            assigned_by INTEGER REFERENCES public.users(id),
            is_active BOOLEAN DEFAULT TRUE,
            
            CONSTRAINT %I_subject_profs_unique UNIQUE(subject_id, professor_id)
        )', p_schema_name, p_schema_name, p_schema_name);
    
    EXECUTE format('CREATE INDEX idx_%I_subject_profs_subject ON %I.subject_professors(subject_id)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_subject_profs_prof ON %I.subject_professors(professor_id)', 
        p_schema_name, p_schema_name);
    
    -- ========================================================================
    -- Lectures table
    -- ========================================================================
    EXECUTE format('
        CREATE TABLE %I.lectures (
            id SERIAL PRIMARY KEY,
            subject_id INTEGER NOT NULL REFERENCES %I.subjects(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            order_number INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            created_by INTEGER REFERENCES public.users(id),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_published BOOLEAN DEFAULT FALSE,
            published_at TIMESTAMP,
            
            CONSTRAINT %I_lectures_order_unique UNIQUE(subject_id, order_number),
            CONSTRAINT %I_lectures_order_positive CHECK (order_number > 0)
        )', p_schema_name, p_schema_name, p_schema_name, p_schema_name);
    
    EXECUTE format('CREATE INDEX idx_%I_lectures_subject ON %I.lectures(subject_id)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_lectures_published ON %I.lectures(is_published)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_lectures_order ON %I.lectures(subject_id, order_number)', 
        p_schema_name, p_schema_name);
    
    -- Add updated_at trigger
    EXECUTE format('
        CREATE TRIGGER update_%I_lectures_updated_at
        BEFORE UPDATE ON %I.lectures
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()', p_schema_name, p_schema_name);
    
    -- ========================================================================
    -- Lecture Content table
    -- ========================================================================
    EXECUTE format('
        CREATE TABLE %I.lecture_content (
            id SERIAL PRIMARY KEY,
            lecture_id INTEGER NOT NULL REFERENCES %I.lectures(id) ON DELETE CASCADE,
            content_type content_type NOT NULL DEFAULT ''markdown'',
            content TEXT NOT NULL,
            version INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT NOW(),
            created_by INTEGER REFERENCES public.users(id),
            
            CONSTRAINT %I_lecture_content_version_positive CHECK (version > 0)
        )', p_schema_name, p_schema_name, p_schema_name);
    
    EXECUTE format('CREATE INDEX idx_%I_lecture_content_lecture ON %I.lecture_content(lecture_id)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_lecture_content_version ON %I.lecture_content(lecture_id, version)', 
        p_schema_name, p_schema_name);
    
    -- ========================================================================
    -- Subject Students (enrollment)
    -- ========================================================================
    EXECUTE format('
        CREATE TABLE %I.subject_students (
            id SERIAL PRIMARY KEY,
            subject_id INTEGER NOT NULL REFERENCES %I.subjects(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            enrolled_at TIMESTAMP DEFAULT NOW(),
            enrolled_by INTEGER REFERENCES public.users(id),
            status enrollment_status DEFAULT ''active'',
            completed_at TIMESTAMP,
            
            CONSTRAINT %I_subject_students_unique UNIQUE(subject_id, student_id)
        )', p_schema_name, p_schema_name, p_schema_name);
    
    EXECUTE format('CREATE INDEX idx_%I_subject_students_subject ON %I.subject_students(subject_id)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_subject_students_student ON %I.subject_students(student_id)', 
        p_schema_name, p_schema_name);
    EXECUTE format('CREATE INDEX idx_%I_subject_students_status ON %I.subject_students(status)', 
        p_schema_name, p_schema_name);
    
    RAISE NOTICE 'Successfully created university schema: %', p_schema_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_university_schema(VARCHAR) IS 
    'Creates a complete university schema with all required tables';

-- ============================================================================
-- Function to safely delete a university schema
-- ============================================================================
CREATE OR REPLACE FUNCTION drop_university_schema(p_schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Safety check: only drop schemas matching uni_* pattern
    IF p_schema_name !~ '^uni_[0-9]+$' THEN
        RAISE EXCEPTION 'Invalid schema name format: %. Must match pattern: uni_[0-9]+', p_schema_name;
    END IF;
    
    -- Drop the schema and all its objects
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', p_schema_name);
    
    RAISE NOTICE 'Successfully dropped university schema: %', p_schema_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION drop_university_schema(VARCHAR) IS 
    'Safely deletes a university schema and all its data (CASCADE)';
