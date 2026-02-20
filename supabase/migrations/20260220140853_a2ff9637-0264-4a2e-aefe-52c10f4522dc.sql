ALTER TABLE contacts_le
  ADD COLUMN IF NOT EXISTS drip_progress jsonb DEFAULT '[]';