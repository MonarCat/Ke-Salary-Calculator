-- Ensure P9A draft sources have monthly_records for draft read/write compatibility.

ALTER TABLE IF EXISTS public.p9a_records
  ADD COLUMN IF NOT EXISTS monthly_records JSONB DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.annual_tax_records
  ADD COLUMN IF NOT EXISTS monthly_records JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
