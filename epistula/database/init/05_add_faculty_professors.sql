-- ============================================================================
-- Add faculty_professors table to existing university schemas
-- ============================================================================

-- This migration adds faculty_professors table to track which professors
-- are assigned to which faculties, allowing them to create subjects

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
        -- Check if faculty_professors table already exists
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = schema_rec.schema_name 
            AND table_name = 'faculty_professors'
        ) THEN
            -- Create faculty_professors table
            EXECUTE format('
                CREATE TABLE %I.faculty_professors (
                    id SERIAL PRIMARY KEY,
                    faculty_id INTEGER NOT NULL REFERENCES %I.faculties(id) ON DELETE CASCADE,
                    professor_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                    assigned_at TIMESTAMP DEFAULT NOW(),
                    assigned_by INTEGER REFERENCES public.users(id),
                    is_active BOOLEAN DEFAULT TRUE,
                    
                    CONSTRAINT %I_faculty_profs_unique UNIQUE(faculty_id, professor_id)
                )', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);
            
            -- Create indexes
            EXECUTE format('CREATE INDEX idx_%I_faculty_profs_faculty ON %I.faculty_professors(faculty_id)', 
                schema_rec.schema_name, schema_rec.schema_name);
            EXECUTE format('CREATE INDEX idx_%I_faculty_profs_prof ON %I.faculty_professors(professor_id)', 
                schema_rec.schema_name, schema_rec.schema_name);
            
            RAISE NOTICE 'Added faculty_professors table to schema: %', schema_rec.schema_name;
        ELSE
            RAISE NOTICE 'faculty_professors table already exists in schema: %', schema_rec.schema_name;
        END IF;
    END LOOP;
END $$;
