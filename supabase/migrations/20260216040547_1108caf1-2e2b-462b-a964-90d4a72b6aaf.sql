
-- Add ICP classification and high-intent fields to accounts
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS icp_class text DEFAULT 'employer',
  ADD COLUMN IF NOT EXISTS high_intent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_intent_reason text;

-- Create discovery_settings table for blacklist, toggles, ICP band, sweep size
CREATE TABLE IF NOT EXISTS public.discovery_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discovery_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read access" ON public.discovery_settings FOR SELECT USING (true);
CREATE POLICY "Anon write access" ON public.discovery_settings FOR ALL USING (true) WITH CHECK (true);

-- Seed default discovery settings
INSERT INTO public.discovery_settings (key, value) VALUES
  ('blacklist_domains', '["bcbs.com","bcbsma.com","point32health.org","tuftshealth.com","aetna.com","cigna.com","uhc.com","anthem.com","humana.com","kaiser.org","massgeneral.org","brighamandwomens.org","bidmc.org","steward.org","lahey.org","atriushealth.org","tuftsmedicalcenter.org"]'::jsonb),
  ('blacklist_names', '["Blue Cross Blue Shield","Point32Health","Tufts Health Plan","Harvard Pilgrim","Aetna","Cigna","United Healthcare","UnitedHealth","Anthem","Humana","Kaiser Permanente","Mass General Brigham","Partners Healthcare","Beth Israel Lahey","BILH","Steward Health","Atrius Health","Tufts Medical Center","Broad Institute","Wyss Institute","Koch Institute","MIT Lincoln Laboratory"]'::jsonb),
  ('toggles', '{"allow_edu":true,"allow_gov":false,"allow_hospital_systems":false,"allow_university_research":false}'::jsonb),
  ('icp_band', '{"min_employees":20,"max_employees":500}'::jsonb),
  ('sweep_size', '300'::jsonb),
  ('cron_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_discovery_settings_updated_at
  BEFORE UPDATE ON public.discovery_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
