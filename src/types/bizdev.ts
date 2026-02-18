// BIZDEV types for trigger tagging, batches, and campaign workflow

export type TriggerTag = {
  trigger_id?: string;
  label: string;
  category?: string;
  source: 'manual' | 'auto';
};

export type Badge =
  | { kind: 'new_role'; days: number }
  | { kind: 'funding'; days: number }
  | { kind: 'news'; headline: string }
  | { kind: 'reachable'; email: boolean; phone: boolean; linkedin: boolean }
  | { kind: 'hiring'; roles60d: number };

export interface LeadBatch {
  batch_id: string;
  source_batch_id: string;
  campaign_batch_id: string;
  manual_triggers: TriggerTag[];
  created_on: string;
}

export interface ContactRecord {
  contact_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone_direct?: string;
  linkedin_url?: string;
  account_id?: string;
  company_name?: string;
  domain?: string;
  campaign_batch_id?: string;
  batch_id?: string;
  manual_triggers: TriggerTag[];
  auto_triggers: TriggerTag[];
  trigger_profile: TriggerTag[];
  badges: Badge[];
  crm_status: 'none' | 'claimed' | 'rejected' | 'needs_review';
  crm_guid?: string;
  crm_record_url?: string;
  role_start_date?: string;
}

export type CrmStatus = 'none' | 'claimed' | 'rejected' | 'needs_review';
