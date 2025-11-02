-- ============================================================================
-- Add faculty_students table to existing university schemas
-- ============================================================================

-- This migration adds faculty_students table to track which students
-- are assigned to which faculties

DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    -- Loop through all existing university schemas
    FOR schema_rec IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'uni_%'
    LOOP
        -- Check if faculty_students table already exists
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = schema_rec.schema_name 
            AND table_name = 'faculty_students'
        ) THEN
            -- Create faculty_students table
            EXECUTE format('
                CREATE TABLE %I.faculty_students (
                    id SERIAL PRIMARY KEY,
                    faculty_id INTEGER NOT NULL REFERENCES %I.faculties(id) ON DELETE CASCADE,
                    student_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                    assigned_at TIMESTAMP DEFAULT NOW(),
                    assigned_by INTEGER REFERENCES public.users(id),
                    is_active BOOLEAN DEFAULT TRUE,
                    
                    CONSTRAINT %I_faculty_students_unique UNIQUE(faculty_id, student_id)
                )', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);
            
            -- Create indexes
            EXECUTE format('CREATE INDEX idx_%I_faculty_students_faculty ON %I.faculty_students(faculty_id)', 
                schema_rec.schema_name, schema_rec.schema_name);
            EXECUTE format('CREATE INDEX idx_%I_faculty_students_student ON %I.faculty_students(student_id)', 
                schema_rec.schema_name, schema_rec.schema_name);
            
            RAISE NOTICE 'Added faculty_students table to schema: %', schema_rec.schema_name;
        ELSE
            RAISE NOTICE 'faculty_students table already exists in schema: %', schema_rec.schema_name;
        END IF;
    END LOOP;
END $$;