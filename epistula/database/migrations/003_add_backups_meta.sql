-- 003_add_backups_meta.sql
-- Add metadata storage for per-university backup files (editable names/notes)

CREATE TABLE IF NOT EXISTS public.university_backups_meta (
    id            BIGSERIAL PRIMARY KEY,
    university_id INTEGER NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    title         TEXT NULL,
    description   TEXT NULL,
    created_by    INTEGER NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (university_id, filename)
);

CREATE INDEX IF NOT EXISTS idx_backups_meta_uni ON public.university_backups_meta (university_id);
CREATE INDEX IF NOT EXISTS idx_backups_meta_uni_filename ON public.university_backups_meta (university_id, filename);

-- Helper trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_trigger
    WHERE  tgname = 'trg_backups_meta_updated_at'
  ) THEN
    CREATE TRIGGER trg_backups_meta_updated_at
    BEFORE UPDATE ON public.university_backups_meta
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;
