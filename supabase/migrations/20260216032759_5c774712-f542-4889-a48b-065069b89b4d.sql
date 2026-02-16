-- Enable required extensions for scheduled discovery
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add discovery_cron_enabled feature flag
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read access" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "Anon write access" ON public.feature_flags FOR ALL USING (true) WITH CHECK (true);

-- Insert default flag (disabled until dry-run passes)
INSERT INTO public.feature_flags (key, enabled) VALUES ('discovery_cron_enabled', false)
ON CONFLICT (key) DO NOTHING;