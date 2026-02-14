
-- Add disposition column to accounts
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS disposition text NOT NULL DEFAULT 'active';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_accounts_disposition ON public.accounts (disposition);

-- Comment for documentation
COMMENT ON COLUMN public.accounts.disposition IS 'Lead disposition: active, needs_review, rejected_existing_client, rejected_owned_by_other_rep, rejected_bad_fit, rejected_no_opportunity, suppressed';
