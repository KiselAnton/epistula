-- Add missing columns to faculties table in all university schemas
-- This updates existing university schemas to match the new structure

DO $$
DECLARE
    schema_record RECORD;
BEGIN
    -- Loop through all university schemas
    FOR schema_record IN 
        SELECT schema_name 
        FROM public.universities 
        WHERE is_active = true
    LOOP
        -- Add university_id column if it doesn't exist
        EXECUTE format('
            ALTER TABLE %I.faculties 
            ADD COLUMN IF NOT EXISTS university_id INTEGER NOT NULL DEFAULT 0
        ', schema_record.schema_name);
        
        -- Add short_name column if it doesn't exist
        EXECUTE format('
            ALTER TABLE %I.faculties 
            ADD COLUMN IF NOT EXISTS short_name VARCHAR(50)
        ', schema_record.schema_name);
        
        -- Add logo_url column if it doesn't exist
        EXECUTE format('
            ALTER TABLE %I.faculties 
            ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)
        ', schema_record.schema_name);
        
        -- Update created_at to use timezone if needed
        EXECUTE format('
            ALTER TABLE %I.faculties 
            ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
        ', schema_record.schema_name);
        
        -- Update updated_at to use timezone if needed  
        EXECUTE format('
            ALTER TABLE %I.faculties 
            ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE
        ', schema_record.schema_name);
        
        RAISE NOTICE 'Updated faculties table in schema: %', schema_record.schema_name;
    END LOOP;
END $$;
