
-- Add pipeline tracking columns to contacts_le (no new tables)
ALTER TABLE public.contacts_le
  ADD COLUMN IF NOT EXISTS pipeline_stage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch timestamptz,
  ADD COLUMN IF NOT EXISTS next_touch timestamptz;
