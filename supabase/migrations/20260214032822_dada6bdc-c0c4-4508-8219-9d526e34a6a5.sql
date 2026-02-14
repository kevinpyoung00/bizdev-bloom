
-- Allow anon read access for internal tool (no public users)
CREATE POLICY "Anon read access" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.contacts_le FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.lead_queue FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.coi_queue FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.cois FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.coi_contacts FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.account_briefs FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.email_drafts FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.enrichment_runs FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.audit_log FOR SELECT USING (true);
