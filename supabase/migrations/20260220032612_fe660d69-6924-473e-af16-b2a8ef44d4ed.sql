
-- Add campaign_tags to contacts_le
ALTER TABLE public.contacts_le ADD COLUMN IF NOT EXISTS campaign_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add pushed_to_crm_at to contacts_le
ALTER TABLE public.contacts_le ADD COLUMN IF NOT EXISTS pushed_to_crm_at timestamptz;

-- Add campaign_tags to lead_queue
ALTER TABLE public.lead_queue ADD COLUMN IF NOT EXISTS campaign_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add pushed_to_crm_at to lead_queue
ALTER TABLE public.lead_queue ADD COLUMN IF NOT EXISTS pushed_to_crm_at timestamptz;

-- Add bizdev_crm_id to lead_queue (references contact id)
ALTER TABLE public.lead_queue ADD COLUMN IF NOT EXISTS bizdev_crm_id uuid;
