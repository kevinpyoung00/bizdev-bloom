
-- Add Zywave ID and D365 ownership fields to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS zywave_id text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS d365_owner_name text;
