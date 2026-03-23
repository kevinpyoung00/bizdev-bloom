-- Normalize existing account domains: strip protocol and www prefix
UPDATE accounts 
SET domain = regexp_replace(
  regexp_replace(
    regexp_replace(domain, '^https?://', ''),
    '^www\.', ''
  ),
  '/+$', ''
)
WHERE domain IS NOT NULL 
  AND domain ~ '^https?://';