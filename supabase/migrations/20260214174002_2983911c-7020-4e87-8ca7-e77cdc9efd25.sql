
-- Add lead status flow columns to lead_queue
ALTER TABLE public.lead_queue 
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS persona text,
  ADD COLUMN IF NOT EXISTS industry_key text,
  ADD COLUMN IF NOT EXISTS reject_reason text;

-- Create industry_settings table
CREATE TABLE public.industry_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.industry_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read access" ON public.industry_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated full access" ON public.industry_settings FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_industry_settings_updated_at
  BEFORE UPDATE ON public.industry_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default industries
INSERT INTO public.industry_settings (key, display_name, sort_order) VALUES
  ('biotech_life_sciences', 'Biotech & Life Sciences', 1),
  ('tech_pst', 'Tech / Professional, Scientific & Technical', 2),
  ('advanced_mfg_med_devices', 'Advanced Manufacturing & Medical Devices', 3),
  ('healthcare_social_assistance', 'Healthcare & Social Assistance', 4),
  ('higher_ed_nonprofit', 'Higher Education & Nonprofit', 5);

-- Create message_snapshots table
CREATE TABLE public.message_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_queue_id uuid REFERENCES public.lead_queue(id),
  account_id uuid REFERENCES public.accounts(id),
  contact_id uuid REFERENCES public.contacts_le(id),
  week_number integer NOT NULL,
  channel text NOT NULL, -- email, linkedin, phone
  persona text,
  industry_key text,
  subject text,
  body text NOT NULL,
  tokens_used jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read access" ON public.message_snapshots FOR SELECT USING (true);
CREATE POLICY "Authenticated full access" ON public.message_snapshots FOR ALL USING (auth.uid() IS NOT NULL);
