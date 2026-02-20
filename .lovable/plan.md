

## Problem

Right now, clicking any channel button (LinkedIn/Email/Phone) in the expanded 12-week drip view calls `advancePipeline`, which bumps `pipeline_stage` to 1, 2, or 3. Since `currentWeek` is derived from `pipeline_stage + 1`, this instantly marks entire weeks as completed. There is no per-channel tracking for DB contacts.

The Contacts section (CRM/localStorage) tracks each channel individually per week via `WeekProgress` objects with `liDone`, `emailDone`, `phoneDone` fields. The campaign section needs the same granularity.

## Solution

Add a `drip_progress` JSONB column to `contacts_le` and update the campaign drip view to track and display per-channel completion for each week.

---

### 1. Database Migration

Add a new column to `contacts_le`:

```sql
ALTER TABLE contacts_le
  ADD COLUMN IF NOT EXISTS drip_progress jsonb DEFAULT '[]';
```

This stores an array like:
```json
[
  {"week": 1, "liDone": true, "emailDone": false, "phoneDone": false},
  {"week": 2, "liDone": false, "emailDone": true, "phoneDone": false}
]
```

---

### 2. Update CampaignContactsTable.tsx

**Fetch `drip_progress`** in the query alongside existing fields.

**Replace the current "Copy & Advance Pipeline" behavior:**
- When the user clicks "Copy & Advance" in the draft modal, mark only that specific channel as done for that specific week in `drip_progress`
- Only advance `pipeline_stage` when ALL channels for a week are completed (LinkedIn + Email done, plus Phone if it's a call week)
- Update `last_touch` and `next_touch` on every channel completion

**Show per-channel completion status on each week card:**
- Add small check icons or muted styling next to each channel button when that channel is already done for that week
- Completed channels get a checkmark icon and reduced opacity (like the Contacts section)
- Incomplete channels remain fully interactive

**Derive `currentWeek` from `drip_progress`** instead of `pipeline_stage`:
- Current week = the earliest week where not all channels are completed
- This prevents jumping ahead when only one channel is done

---

### 3. New helper: markChannelDone

Create a function in `CampaignContactsTable` (or in `usePipelineUpdate`) that:

1. Reads the contact's current `drip_progress` array
2. Finds or creates the entry for the target week
3. Toggles the specific channel (`liDone`/`emailDone`/`phoneDone`)
4. Checks if all channels for that week are now complete
5. If all done: advances `pipeline_stage` and sets `next_touch` = now + 7 days (next week)
6. If not all done: updates `last_touch` only
7. Writes both `drip_progress` and (optionally) `pipeline_stage` back to DB
8. Invalidates relevant queries

---

### 4. Visual Changes to Week Cards

Each week card's channel buttons will show:
- A check icon overlay when that channel is done for the week
- Reduced opacity for completed channels
- A "Week completed" badge when all channels are done (matching Contacts section behavior)

The progress bar will be based on completed weeks (all channels done) rather than `pipeline_stage`.

---

### Files Changed

| File | Change |
|------|--------|
| Database migration | Add `drip_progress jsonb DEFAULT '[]'` to `contacts_le` |
| `src/components/crm/CampaignContactsTable.tsx` | Fetch `drip_progress`, add `markChannelDone` logic, show per-channel completion on week cards, derive `currentWeek` from progress |
| `src/hooks/usePipelineUpdate.ts` | Optionally add a `markChannelDone` method for reuse |

