
-- Phase 1: BIZDEV triggers + intake

-- 1. Trigger dictionary
CREATE TABLE IF NOT EXISTS public.trigger_dictionary (
  trigger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  category TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trigger_dictionary_label ON public.trigger_dictionary (LOWER(label));

ALTER TABLE public.trigger_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read trigger_dictionary" ON public.trigger_dictionary FOR SELECT USING (true);
CREATE POLICY "Anon write trigger_dictionary" ON public.trigger_dictionary FOR ALL USING (true) WITH CHECK (true);

-- 2. Lead batches
CREATE TABLE IF NOT EXISTS public.lead_batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_batch_id TEXT UNIQUE,
  campaign_batch_id TEXT NOT NULL,
  manual_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read lead_batches" ON public.lead_batches FOR SELECT USING (true);
CREATE POLICY "Anon write lead_batches" ON public.lead_batches FOR ALL USING (true) WITH CHECK (true);

-- 3. Add columns to contacts_le
ALTER TABLE public.contacts_le
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.lead_batches(batch_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS manual_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trigger_profile JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS crm_guid UUID,
  ADD COLUMN IF NOT EXISTS crm_record_url TEXT,
  ADD COLUMN IF NOT EXISTS crm_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS role_start_date DATE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_le_email ON public.contacts_le (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_contacts_le_crm_guid ON public.contacts_le (crm_guid);
CREATE INDEX IF NOT EXISTS idx_contacts_le_batch_id ON public.contacts_le (batch_id);

-- 5. Feature flags for staged rollout
INSERT INTO public.feature_flags (key, enabled) VALUES
  ('bizdev_triggers', false),
  ('bizdev_merge', false),
  ('bizdev_d365_export', false),
  ('bizdev_review', false),
  ('bizdev_campaign_bulk', false)
ON CONFLICT (key) DO NOTHING;

-- 6. D365 contacts cache for success re-import (future phase)
CREATE TABLE IF NOT EXISTS public.d365_contacts_cache (
  email TEXT PRIMARY KEY,
  owner TEXT,
  last_activity_date DATE,
  account_domain TEXT
);

ALTER TABLE public.d365_contacts_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read d365_contacts_cache" ON public.d365_contacts_cache FOR SELECT USING (true);
CREATE POLICY "Anon write d365_contacts_cache" ON public.d365_contacts_cache FOR ALL USING (true) WITH CHECK (true);
