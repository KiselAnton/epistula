-- Migration 004: Enforce non-empty code for universities
-- This prevents the universities list endpoint from breaking due to empty codes
-- which fail Pydantic response validation (min_length=1).

-- Add CHECK constraint to ensure code is not empty after trimming
ALTER TABLE public.universities
ADD CONSTRAINT universities_code_not_empty 
CHECK (btrim(code) <> '');

-- Add comment documenting the constraint
COMMENT ON CONSTRAINT universities_code_not_empty ON public.universities IS 
'Ensures university code is not empty or whitespace-only to prevent API serialization failures';
