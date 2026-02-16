
-- Add rejected_at timestamp column
ALTER TABLE public.lead_queue ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE NULL;

-- Rename reject_reason to rejected_reason
ALTER TABLE public.lead_queue RENAME COLUMN reject_reason TO rejected_reason;
