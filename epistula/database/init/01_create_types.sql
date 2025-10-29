-- ============================================================================
-- Epistula Database Initialization
-- Part 1: Create Enums and Base Types
-- ============================================================================

-- Create user role enumeration
CREATE TYPE user_role AS ENUM ('root', 'uni_admin', 'professor', 'student');

-- Create enrollment status enumeration
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped', 'suspended');

-- Create content type enumeration
CREATE TYPE content_type AS ENUM ('markdown', 'video', 'pdf', 'image', 'link', 'other');

-- Create audit log action enumeration
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'access');

COMMENT ON TYPE user_role IS 'User roles: root (super admin), uni_admin (university admin), professor, student';
COMMENT ON TYPE enrollment_status IS 'Student enrollment status in a subject';
COMMENT ON TYPE content_type IS 'Types of lecture content';
COMMENT ON TYPE audit_action IS 'Types of auditable actions';
