-- Add logo_url column to universities table
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Add comment to column
COMMENT ON COLUMN public.universities.logo_url IS 'URL or path to university logo image';
