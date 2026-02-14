
-- Lead Engine: Phase 1 - All tables

-- 1. accounts
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  domain TEXT UNIQUE,
  industry TEXT,
  sub_industry TEXT,
  naics_code TEXT,
  employee_count INTEGER,
  revenue_range TEXT,
  hq_city TEXT,
  hq_state TEXT,
  hq_country TEXT DEFAULT 'US',
  geography_bucket TEXT DEFAULT 'US',
  triggers JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  icp_score INTEGER DEFAULT 0,
  lead_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. contacts
CREATE TABLE public.contacts_le (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  seniority TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  location TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. lead_queue
CREATE TABLE public.lead_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  priority_rank INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reason JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_date, account_id)
);

-- 4. enrichment_runs
CREATE TABLE public.enrichment_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL,
  file_ref TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  rows_total INTEGER DEFAULT 0,
  rows_processed INTEGER DEFAULT 0,
  rows_merged INTEGER DEFAULT 0,
  rows_new_accounts INTEGER DEFAULT 0,
  rows_new_contacts INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]'::jsonb
);

-- 5. account_briefs
CREATE TABLE public.account_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  brief_markdown TEXT NOT NULL DEFAULT '',
  inputs JSONB DEFAULT '{}'::jsonb,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ
);

-- 6. email_drafts
CREATE TABLE public.email_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts_le(id) ON DELETE SET NULL,
  persona TEXT,
  subject TEXT,
  body_markdown TEXT,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  send_status TEXT DEFAULT 'draft'
);

-- 7. audit_log
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

-- 8. cois
CREATE TABLE public.cois (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  firm_type TEXT,
  website TEXT,
  region TEXT,
  notes TEXT DEFAULT '',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. coi_contacts
CREATE TABLE public.coi_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coi_id UUID REFERENCES public.cois(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. coi_queue
CREATE TABLE public.coi_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coi_id UUID REFERENCES public.cois(id) ON DELETE CASCADE,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  priority_rank INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reason JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_accounts_domain ON public.accounts(domain);
CREATE INDEX idx_accounts_industry_size ON public.accounts(industry, employee_count);
CREATE INDEX idx_lead_queue_run_rank ON public.lead_queue(run_date, priority_rank);
CREATE INDEX idx_coi_queue_run_rank ON public.coi_queue(run_date, priority_rank);
CREATE INDEX idx_contacts_le_account ON public.contacts_le(account_id);
CREATE INDEX idx_coi_contacts_coi ON public.coi_contacts(coi_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_le_updated_at BEFORE UPDATE ON public.contacts_le FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lead_queue_updated_at BEFORE UPDATE ON public.lead_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cois_updated_at BEFORE UPDATE ON public.cois FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coi_contacts_updated_at BEFORE UPDATE ON public.coi_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coi_queue_updated_at BEFORE UPDATE ON public.coi_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: For now, enable RLS but allow all access (this is an internal tool, no public users)
-- We'll tighten this when auth is added

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_le ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coi_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coi_queue ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users
CREATE POLICY "Authenticated full access" ON public.accounts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.contacts_le FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.lead_queue FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.enrichment_runs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.account_briefs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.email_drafts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.audit_log FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.cois FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.coi_contacts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.coi_queue FOR ALL USING (auth.uid() IS NOT NULL);
