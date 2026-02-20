
-- Add match_key column to contacts_le for dedup/reconciliation
ALTER TABLE public.contacts_le ADD COLUMN IF NOT EXISTS match_key text;

-- Populate match_key for existing rows: email if present, else first+last@domain
UPDATE public.contacts_le
SET match_key = CASE
  WHEN email IS NOT NULL AND trim(email) != '' THEN lower(trim(email))
  ELSE concat(
    lower(regexp_replace(coalesce(first_name, ''), '\s+', '', 'g')),
    lower(regexp_replace(coalesce(last_name, ''), '\s+', '', 'g')),
    '@',
    lower(regexp_replace(regexp_replace(coalesce(
      (SELECT a.domain FROM accounts a WHERE a.id = contacts_le.account_id),
      ''
    ), '^https?://', ''), '^www\.', ''))
  )
END
WHERE match_key IS NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_contacts_le_match_key ON public.contacts_le (match_key);
CREATE INDEX IF NOT EXISTS idx_contacts_le_batch_match ON public.contacts_le (batch_id, match_key);
