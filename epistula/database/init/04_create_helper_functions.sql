-- ============================================================================
-- Epistula Database Initialization
-- Part 4: Helper Functions and Views
-- ============================================================================

-- Function to get all roles for a user across all universities
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id INTEGER)
RETURNS TABLE (
    university_id INTEGER,
    university_name VARCHAR,
    role user_role,
    faculty_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uur.university_id,
        u.name,
        uur.role,
        uur.faculty_id
    FROM public.user_university_roles uur
    JOIN public.universities u ON uur.university_id = u.id
    WHERE uur.user_id = p_user_id
        AND uur.is_active = TRUE
        AND u.is_active = TRUE
    ORDER BY u.name, uur.role;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_roles(INTEGER) IS 
    'Returns all active roles for a user across all universities';

-- Function to check if user has a specific role in a university
CREATE OR REPLACE FUNCTION has_role(
    p_user_id INTEGER,
    p_university_id INTEGER,
    p_role user_role
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.user_university_roles
    WHERE user_id = p_user_id
        AND university_id = p_university_id
        AND role = p_role
        AND is_active = TRUE;
    
    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION has_role(INTEGER, INTEGER, user_role) IS 
    'Check if a user has a specific role in a university';

-- Function to check if user is root
CREATE OR REPLACE FUNCTION is_root_user(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_root BOOLEAN;
BEGIN
    SELECT is_root
    INTO v_is_root
    FROM public.users
    WHERE id = p_user_id
        AND is_active = TRUE;
    
    RETURN COALESCE(v_is_root, FALSE);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_root_user(INTEGER) IS 
    'Check if a user is a root user';

-- View: User summary with role counts
CREATE OR REPLACE VIEW public.v_user_summary AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.is_root,
    u.is_active,
    u.created_at,
    u.last_login,
    COUNT(DISTINCT uur.university_id) as university_count,
    COUNT(DISTINCT CASE WHEN uur.role = 'uni_admin' THEN uur.university_id END) as admin_at_count,
    COUNT(DISTINCT CASE WHEN uur.role = 'professor' THEN uur.university_id END) as professor_at_count,
    COUNT(DISTINCT CASE WHEN uur.role = 'student' THEN uur.university_id END) as student_at_count
FROM public.users u
LEFT JOIN public.user_university_roles uur ON u.id = uur.user_id AND uur.is_active = TRUE
GROUP BY u.id, u.email, u.name, u.is_root, u.is_active, u.created_at, u.last_login;

COMMENT ON VIEW public.v_user_summary IS 
    'Summary view of users with their role counts across universities';

-- View: University summary
CREATE OR REPLACE VIEW public.v_university_summary AS
SELECT 
    u.id,
    u.name,
    u.code,
    u.schema_name,
    u.is_active,
    u.created_at,
    COUNT(DISTINCT CASE WHEN uur.role = 'uni_admin' THEN uur.user_id END) as admin_count,
    COUNT(DISTINCT CASE WHEN uur.role = 'professor' THEN uur.user_id END) as professor_count,
    COUNT(DISTINCT CASE WHEN uur.role = 'student' THEN uur.user_id END) as student_count,
    COUNT(DISTINCT uur.user_id) as total_user_count
FROM public.universities u
LEFT JOIN public.user_university_roles uur ON u.id = uur.university_id AND uur.is_active = TRUE
GROUP BY u.id, u.name, u.code, u.schema_name, u.is_active, u.created_at;

COMMENT ON VIEW public.v_university_summary IS 
    'Summary view of universities with user counts';

-- ============================================================================
-- Trigger Functions for Data Integrity
-- ============================================================================

-- Trigger function to validate faculty_id for students
CREATE OR REPLACE FUNCTION validate_student_faculty()
RETURNS TRIGGER AS $$
DECLARE
    v_schema_name VARCHAR(63);
    v_faculty_exists BOOLEAN;
BEGIN
    -- Only validate for students
    IF NEW.role != 'student' THEN
        RETURN NEW;
    END IF;
    
    -- Students must have a faculty_id
    IF NEW.faculty_id IS NULL THEN
        RAISE EXCEPTION 'Students must be assigned to a faculty';
    END IF;
    
    -- Get the university's schema name
    SELECT schema_name INTO v_schema_name
    FROM public.universities
    WHERE id = NEW.university_id;
    
    IF v_schema_name IS NULL THEN
        RAISE EXCEPTION 'University not found: %', NEW.university_id;
    END IF;
    
    -- Check if faculty exists in the university's schema
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.faculties WHERE id = $1 AND is_active = TRUE)', 
        v_schema_name)
    INTO v_faculty_exists
    USING NEW.faculty_id;
    
    IF NOT v_faculty_exists THEN
        RAISE EXCEPTION 'Faculty % does not exist in university %', NEW.faculty_id, NEW.university_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_university_roles
CREATE TRIGGER validate_student_faculty_trigger
    BEFORE INSERT OR UPDATE ON public.user_university_roles
    FOR EACH ROW
    EXECUTE FUNCTION validate_student_faculty();

COMMENT ON FUNCTION validate_student_faculty() IS 
    'Validates that students are assigned to a valid faculty in their university';

-- Trigger function to prevent multiple root users
CREATE OR REPLACE FUNCTION prevent_multiple_roots()
RETURNS TRIGGER AS $$
DECLARE
    v_root_count INTEGER;
BEGIN
    IF NEW.is_root = TRUE THEN
        SELECT COUNT(*)
        INTO v_root_count
        FROM public.users
        WHERE is_root = TRUE
            AND id != COALESCE(NEW.id, -1)
            AND is_active = TRUE;
        
        IF v_root_count > 0 THEN
            RAISE EXCEPTION 'Only one active root user is allowed';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER prevent_multiple_roots_trigger
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_multiple_roots();

COMMENT ON FUNCTION prevent_multiple_roots() IS 
    'Ensures only one active root user exists in the system';

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Function to create a university (creates record + schema)
CREATE OR REPLACE FUNCTION create_university(
    p_name VARCHAR(255),
    p_code VARCHAR(50),
    p_description TEXT,
    p_created_by INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_university_id INTEGER;
    v_schema_name VARCHAR(63);
BEGIN
    -- Insert university record
    INSERT INTO public.universities (name, code, description, created_by, schema_name)
    VALUES (
        p_name,
        UPPER(p_code),
        p_description,
        p_created_by,
        'uni_' || nextval('universities_id_seq')
    )
    RETURNING id, schema_name INTO v_university_id, v_schema_name;
    
    -- Create the schema
    PERFORM create_university_schema(v_schema_name);
    
    RETURN v_university_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_university(VARCHAR, VARCHAR, TEXT, INTEGER) IS 
    'Creates a new university and its dedicated schema';
