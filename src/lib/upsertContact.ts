import { supabase } from '@/integrations/supabase/client';
import { normalizeMatchKey } from '@/lib/matchKey';

interface LeadLike {
  id: string;
  account_id: string | null;
  account?: {
    name?: string;
    domain?: string;
    website?: string;
  };
  primaryContact?: {
    first_name: string;
    last_name: string;
    email?: string | null;
    title?: string | null;
    phone?: string | null;
    linkedin_url?: string | null;
  } | null;
}

interface UpsertResult {
  contactId: string;
  created: boolean;
  error?: string;
}

/**
 * Upsert a contact from a lead row. 
 * Returns the contactId. Uses match_key for dedup.
 */
export async function upsertContactFromLead(
  lead: LeadLike,
  batchId: string,
  campaignTags?: string[],
): Promise<UpsertResult> {
  const pc = lead.primaryContact;
  if (!pc) {
    // Try to load primary contact from DB
    if (!lead.account_id) return { contactId: '', created: false, error: 'No account_id' };
    const { data: contacts } = await supabase
      .from('contacts_le')
      .select('id, first_name, last_name, email, title, phone, linkedin_url, match_key, campaign_tags, batch_id')
      .eq('account_id', lead.account_id)
      .eq('is_primary', true)
      .limit(1);
    
    if (!contacts || contacts.length === 0) {
      // Grab any contact for this account
      const { data: anyContacts } = await supabase
        .from('contacts_le')
        .select('id, first_name, last_name, email, title, phone, linkedin_url, match_key, campaign_tags, batch_id')
        .eq('account_id', lead.account_id)
        .limit(1);
      
      if (!anyContacts || anyContacts.length === 0) {
        return { contactId: '', created: false, error: 'No contacts found for account' };
      }
      return updateExistingContact(anyContacts[0], batchId, campaignTags);
    }
    return updateExistingContact(contacts[0], batchId, campaignTags);
  }

  const mk = normalizeMatchKey({
    email: pc.email,
    first_name: pc.first_name,
    last_name: pc.last_name,
    domain: lead.account?.domain || lead.account?.website || '',
  });

  if (!mk || mk === '@') {
    return { contactId: '', created: false, error: `Cannot compute match_key for ${pc.first_name} ${pc.last_name}` };
  }

  // Check for existing contact by match_key
  const { data: existing } = await supabase
    .from('contacts_le')
    .select('id, campaign_tags')
    .eq('match_key', mk)
    .limit(1);

  const mergedTags = mergeTags(
    (existing?.[0] as any)?.campaign_tags || [],
    campaignTags || [],
  );

  if (existing && existing.length > 0) {
    // Update existing
    await supabase.from('contacts_le').update({
      first_name: pc.first_name,
      last_name: pc.last_name,
      email: pc.email || undefined,
      title: pc.title || undefined,
      phone: pc.phone || undefined,
      linkedin_url: pc.linkedin_url || undefined,
      batch_id: batchId,
      pushed_to_crm_at: new Date().toISOString(),
      campaign_tags: mergedTags as any,
    } as any).eq('id', existing[0].id);

    return { contactId: existing[0].id, created: false };
  }

  // Create new
  const { data: created, error } = await supabase.from('contacts_le').insert({
    first_name: pc.first_name,
    last_name: pc.last_name,
    email: pc.email || null,
    title: pc.title || null,
    phone: pc.phone || null,
    linkedin_url: pc.linkedin_url || null,
    account_id: lead.account_id,
    match_key: mk,
    batch_id: batchId,
    crm_status: 'claimed',
    pushed_to_crm_at: new Date().toISOString(),
    campaign_tags: (campaignTags || []) as any,
    is_primary: true,
  } as any).select('id').single();

  if (error) return { contactId: '', created: false, error: error.message };
  return { contactId: created.id, created: true };
}

async function updateExistingContact(
  contact: any,
  batchId: string,
  campaignTags?: string[],
): Promise<UpsertResult> {
  const mergedTags = mergeTags(contact.campaign_tags || [], campaignTags || []);
  await supabase.from('contacts_le').update({
    batch_id: batchId,
    pushed_to_crm_at: new Date().toISOString(),
    campaign_tags: mergedTags as any,
  } as any).eq('id', contact.id);
  return { contactId: contact.id, created: false };
}

export function mergeTags(existing: string[], newTags: string[]): string[] {
  return [...new Set([...(existing || []), ...(newTags || [])])];
}
