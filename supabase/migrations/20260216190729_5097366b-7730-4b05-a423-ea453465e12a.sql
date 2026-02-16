
-- Add anon write access to contacts_le (matching pattern used by accounts, lead_queue, audit_log)
CREATE POLICY "Anon write access"
ON public.contacts_le
FOR ALL
USING (true)
WITH CHECK (true);
