

## Claimed Tab + Batch Grouping + Pretty Batch IDs

### Overview
Add a dedicated "Claimed" tab to the Lead Queue, enhance batch display with human-readable labels, and add batch filtering/grouping to both the Claimed and Needs Review tabs.

### 1. New Component: ClaimedTab

Create `src/components/lead-engine/ClaimedTab.tsx` that:
- Queries `lead_queue` where `claim_status = 'claimed'` (joined with `accounts`)
- Fetches primary contacts per account (same pattern as `useLeadQueue`)
- Displays a table with columns: Checkbox, Company, Batch, Industry, Emp, Contact, D365 Status, Actions
- Actions: "Add to Campaign", "Mark Uploaded", "Details" (opens AccountDrawer)
- Supports row selection, bulk actions (Add to Campaign, Mark Uploaded)
- Accepts a `batchFilter` prop for filtering by batch
- Accepts a `batches` prop for batch label resolution

### 2. Pretty Batch Labels

Create a utility `src/lib/batchLabel.ts`:
- Function `buildBatchLabel(batch: { created_on: string; source_batch_id: string | null; campaign_batch_id: string })` returns a human-readable string
- Format: `YYYY-MM-DD . Source . ShortName`
  - Date from `created_on`
  - Source: derived from `source_batch_id` filename (detect "apollo", "zoominfo", "d365" keywords) or fallback to "Import"
  - ShortName: first 16 chars of the filename (from `source_batch_id`) or `campaign_batch_id`, truncated with "..."
- Examples: `2026-02-18 . Apollo . Banks-MA-1...`

Create a chip component `src/components/lead-engine/BatchChip.tsx`:
- Renders the pretty label in a rounded Badge
- Tooltip on hover shows full label + internal batch_id
- Clickable to set batch filter

### 3. Tab Structure Changes in LeadQueue.tsx

Update the tabs from `queue | needs-review | rejected` to `queue | claimed | needs-review | rejected`:
- Add "Claimed" tab trigger with count badge (number of claimed leads)
- Render `ClaimedTab` inside the new tab content
- Pass batch filter state and batches data down

### 4. Batch Filter on Claimed + Needs Review

- Move the batch filter dropdown into a shared control that appears on both Queue and Claimed tabs
- On Needs Review tab, show batch chips on contact rows (using `contacts_le.batch_id` join)

### 5. Persist Active Tab

- Store last active tab in `localStorage` (extend existing `STORAGE_KEY` filter persistence)
- Restore on mount

### Technical Details

**Files to create:**
- `src/lib/batchLabel.ts` -- batch label builder utility
- `src/components/lead-engine/BatchChip.tsx` -- reusable batch chip with tooltip
- `src/components/lead-engine/ClaimedTab.tsx` -- claimed leads table component

**Files to modify:**
- `src/pages/LeadQueue.tsx` -- add Claimed tab trigger/content, persist tab, replace raw batch labels with BatchChip, pass batch data to ClaimedTab
- `src/components/lead-engine/NeedsReviewTab.tsx` -- add batch chip display on contact rows

**No database changes required.** All batch label computation is derived from existing `lead_batches` data (`created_on`, `source_batch_id`, `campaign_batch_id`).

**Query for ClaimedTab:**
```sql
SELECT lq.*, accounts.* 
FROM lead_queue lq
JOIN accounts ON lq.account_id = accounts.id
WHERE lq.claim_status = 'claimed'
ORDER BY lq.claimed_at DESC
```
Plus contact fetch for primary contacts (same pattern as existing `useLeadQueue`).

