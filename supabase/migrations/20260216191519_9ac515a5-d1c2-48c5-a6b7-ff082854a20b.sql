
-- Drop the restrictive anon write policy and recreate as permissive
DROP POLICY IF EXISTS "Anon write access" ON public.contacts_le;
CREATE POLICY "Anon write access" ON public.contacts_le FOR ALL TO anon USING (true) WITH CHECK (true);

-- Also fix: the "Authenticated full access" restrictive policy blocks anon writes
-- Make it permissive instead
DROP POLICY IF EXISTS "Authenticated full access" ON public.contacts_le;
CREATE POLICY "Authenticated full access" ON public.contacts_le FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anon read access" ON public.contacts_le;
CREATE POLICY "Anon read access" ON public.contacts_le FOR SELECT TO anon USING (true);
