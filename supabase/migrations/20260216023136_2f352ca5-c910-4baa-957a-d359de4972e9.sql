
-- Allow anon write access to lead_queue (app has no auth)
CREATE POLICY "Anon write access"
ON public.lead_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow anon write access to audit_log
CREATE POLICY "Anon write access"
ON public.audit_log
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow anon write access to accounts (for needs_review, disposition updates)
CREATE POLICY "Anon write access"
ON public.accounts
FOR ALL
USING (true)
WITH CHECK (true);
