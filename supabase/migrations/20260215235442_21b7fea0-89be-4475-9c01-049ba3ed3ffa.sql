
-- Add new D365 flow fields to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS d365_status text NOT NULL DEFAULT 'unknown';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS d365_last_activity timestamptz;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS d365_account_id text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS canonical_company_name text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS merge_keys jsonb DEFAULT '{}'::jsonb;

-- Add import_log to contacts_le for multi-source tracking
ALTER TABLE public.contacts_le ADD COLUMN IF NOT EXISTS import_log jsonb DEFAULT '[]'::jsonb;

-- Compute canonical names for existing accounts
UPDATE public.accounts SET canonical_company_name = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(name, '\s+(inc|llc|co|corp|ltd|lp|plc|pllc|pc|pa|dba|group|holdings|enterprises)\.?$', '', 'gi'),
      '[^a-zA-Z0-9\s]', '', 'g'
    ),
    '\s+', ' ', 'g'
  )
) WHERE canonical_company_name IS NULL;
