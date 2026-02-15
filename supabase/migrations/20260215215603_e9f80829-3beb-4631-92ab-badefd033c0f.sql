-- Drop restrictive policies and replace with permissive ones for integration_settings
DROP POLICY IF EXISTS "Anon read access" ON public.integration_settings;
DROP POLICY IF EXISTS "Authenticated full access" ON public.integration_settings;

CREATE POLICY "Allow public read" ON public.integration_settings FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.integration_settings FOR ALL USING (true) WITH CHECK (true);