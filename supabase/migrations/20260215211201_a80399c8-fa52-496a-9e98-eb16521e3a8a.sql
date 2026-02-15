
-- Integration settings: one row per provider with toggle + encrypted key reference
CREATE TABLE public.integration_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  api_key_ref text DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read access" ON public.integration_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated full access" ON public.integration_settings FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add enrichment_log column to contacts_le
ALTER TABLE public.contacts_le ADD COLUMN IF NOT EXISTS enrichment_log jsonb DEFAULT '[]'::jsonb;
