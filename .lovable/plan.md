

# Show Actual Contact Name Instead of Suggested Persona When Contact Exists

## Problem
When you upload leads with real contact names attached, the Lead Queue still shows the "Suggested Persona" recommendation (e.g., "HR Director", "CFO") instead of the actual person's name. The persona suggestion only makes sense for discovery-generated leads where no contact has been identified yet.

## Logic
- **Contact exists** (imported from Sales Nav / ZoomInfo): Show the real name and title (e.g., "Jane Smith - VP People")
- **No contact exists** (discovered lead): Show the suggested persona recommendation as it works today

## Changes

### 1. Update Lead Queue to fetch primary contact data
- Modify `useLeadEngine.ts` to include a separate query (or batch lookup) for primary contacts from `contacts_le` keyed by `account_id`
- Add a `primaryContact` field to the `LeadWithAccount` type containing `first_name`, `last_name`, `title`, `email`, `phone`, `linkedin_url`

### 2. Update SuggestedPersonaBadge or replace it conditionally
- In the Lead Queue table row, check if the lead has a real contact (`primaryContact` is not null and has a name)
  - **Yes**: Render the contact's name and title directly, with reachability icons (email, phone, LinkedIn) showing which data is available
  - **No**: Render the existing `SuggestedPersonaBadge` with persona recommendation and SalesNav search links

### 3. Update Account Drawer
- Same conditional logic in the drawer's persona section:
  - If real contact exists, show their full details (name, title, email, phone, LinkedIn link)
  - If no contact, show the persona recommendation with search links as it works today

### Technical Details

**Files to modify:**
- `src/hooks/useLeadEngine.ts` -- add contact fetching to `useLeadQueue`, extend `LeadWithAccount` type
- `src/pages/LeadQueue.tsx` -- conditional render: real contact name vs. SuggestedPersonaBadge
- `src/components/lead-engine/AccountDrawer.tsx` -- same conditional in the drawer detail view
- `src/components/SuggestedPersonaBadge.tsx` -- no changes needed, just used conditionally

**No database changes required** -- `contacts_le` already has all the fields needed.

