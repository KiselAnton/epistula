-- Ensure faculty_students.id has a default sequence in all uni_* schemas
DO $$
DECLARE
    s TEXT;
    has_default BOOLEAN;
BEGIN
    FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'uni_%' LOOP
        -- Only if the table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = s AND table_name = 'faculty_students'
        ) THEN
            SELECT (column_default IS NOT NULL) INTO has_default
            FROM information_schema.columns
            WHERE table_schema = s AND table_name = 'faculty_students' AND column_name = 'id';

            IF NOT has_default THEN
                -- Create sequence if missing
                EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I.faculty_students_id_seq', s);
                -- Set default on id
                EXECUTE format('ALTER TABLE %I.faculty_students ALTER COLUMN id SET DEFAULT nextval(''%I.faculty_students_id_seq'')', s, s);
                -- Own the sequence by the id column
                EXECUTE format('ALTER SEQUENCE %I.faculty_students_id_seq OWNED BY %I.faculty_students.id', s, s);
                RAISE NOTICE 'Fixed id default for %.faculty_students', s;
            END IF;
        END IF;
    END LOOP;
END $$;