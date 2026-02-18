import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Eye, CheckCircle2, Users, Mail, Phone, Linkedin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useMarkUploaded } from '@/hooks/useLeadActions';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import type { LeadWithAccount, PrimaryContact } from '@/hooks/useLeadEngine';
import type { BatchMeta } from '@/lib/batchLabel';
import BatchChip from './BatchChip';
import D365StatusBadge from './D365StatusBadge';
import LeadStatusBadge from './LeadStatusBadge';
import IndustryChip from './IndustryChip';
import AccountDrawer from './AccountDrawer';

interface ClaimedTabProps {
  batchFilter: string;
  onBatchFilterChange: (batchId: string) => void;
  batches: BatchMeta[];
}

export default function ClaimedTab({ batchFilter, onBatchFilterChange, batches }: ClaimedTabProps) {
  const queryClient = useQueryClient();
  const markUploaded = useMarkUploaded();
  const campaignBulkEnabled = useFeatureFlag('bizdev_campaign_bulk');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLead, setSelectedLead] = useState<LeadWithAccount | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch claimed leads
  const { data: claimedLeads = [], isLoading } = useQuery({
    queryKey: ['claimed-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_queue')
        .select('*, accounts(*)')
        .eq('claim_status', 'claimed')
        .order('claimed_at', { ascending: false });
      if (error) throw error;

      const rows = data || [];
      const accountIds = rows.map((r: any) => r.accounts?.id).filter(Boolean);
      let contactsByAccount = new Map<string, PrimaryContact>();

      if (accountIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts_le')
          .select('account_id, first_name, last_name, title, email, phone, linkedin_url, is_primary, batch_id')
          .in('account_id', accountIds)
          .order('is_primary', { ascending: false });

        for (const c of contacts || []) {
          if (c.account_id && !contactsByAccount.has(c.account_id)) {
            contactsByAccount.set(c.account_id, {
              first_name: c.first_name,
              last_name: c.last_name,
              title: c.title,
              email: c.email,
              phone: c.phone,
              linkedin_url: c.linkedin_url,
            });
          }
        }
      }

      return rows.map((row: any) => ({
        id: row.id,
        priority_rank: row.priority_rank,
        score: row.score,
        reason: row.reason,
        status: row.status,
        run_date: row.run_date,
        claim_status: row.claim_status || 'claimed',
        claimed_at: row.claimed_at,
        persona: row.persona,
        industry_key: row.industry_key,
        rejected_reason: row.rejected_reason,
        rejected_at: row.rejected_at,
        primaryContact: contactsByAccount.get(row.accounts?.id) || null,
        account: row.accounts,
      })) as LeadWithAccount[];
    },
  });

  // Map account_id → batch_id for claimed leads
  const accountIds = claimedLeads.map(l => l.account?.id).filter(Boolean);
  const { data: contactBatchMap = new Map() } = useQuery({
    queryKey: ['claimed-contact-batch-map', accountIds.join(',')],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts_le')
        .select('account_id, batch_id, campaign_batch_id')
        .in('account_id', accountIds)
        .not('batch_id', 'is', null);
      const map = new Map<string, { batch_id: string; campaign_batch_id: string | null }>();
      for (const c of data || []) {
        if (c.account_id && c.batch_id) {
          map.set(c.account_id, { batch_id: c.batch_id, campaign_batch_id: c.campaign_batch_id });
        }
      }
      return map;
    },
  });

  // Filter by batch
  const filteredLeads = batchFilter === 'all'
    ? claimedLeads
    : claimedLeads.filter(l => {
        const bi = contactBatchMap.get(l.account?.id);
        return bi && bi.batch_id === batchFilter;
      });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLeads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  };

  const allSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length;

  const handleMarkUploaded = () => {
    const ids = filteredLeads.filter(l => selectedIds.has(l.id)).map(l => l.id);
    if (ids.length === 0) { toast.info('Select leads to mark as uploaded'); return; }
    markUploaded.mutate(ids, { onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['claimed-leads'] });
    }});
  };

  const handleView = (lead: LeadWithAccount) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={16} /> Loading claimed leads...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Batch filter */}
      {batches.length > 0 && (
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="text-xs text-muted-foreground">Batch:</span>
          <Select value={batchFilter} onValueChange={onBatchFilterChange}>
            <SelectTrigger className="h-7 w-[280px] text-xs">
              <SelectValue placeholder="All batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              {batches.map(b => (
                <SelectItem key={b.batch_id} value={b.batch_id}>
                  <BatchChip batch={b} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {batchFilter !== 'all' && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              setSelectedIds(new Set(filteredLeads.map(l => l.id)));
              toast.info(`Selected ${filteredLeads.length} leads from batch`);
            }}>
              Select All in Batch
            </Button>
          )}
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 mx-4 bg-muted/50 border border-border rounded-lg">
          <span className="text-xs font-medium text-foreground mr-2">{selectedIds.size} selected</span>
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleMarkUploaded} disabled={markUploaded.isPending}>
            {markUploaded.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <CheckCircle2 size={12} className="mr-1" />}
            Mark Uploaded
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {filteredLeads.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">
          {claimedLeads.length === 0 ? 'No claimed leads yet.' : 'No claimed leads match the selected batch filter.'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="w-32">Batch</TableHead>
              <TableHead className="w-28">Industry</TableHead>
              <TableHead className="w-20">Emp.</TableHead>
              <TableHead className="w-36">Contact</TableHead>
              <TableHead className="w-28">D365</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Claimed</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map(lead => {
              const batchInfo = contactBatchMap.get(lead.account?.id);
              const batchMeta = batchInfo ? batches.find(b => b.batch_id === batchInfo.batch_id) : null;
              const d365Status = (lead.account as any)?.d365_status || 'unknown';

              return (
                <TableRow
                  key={lead.id}
                  className={`cursor-pointer ${selectedIds.has(lead.id) ? 'bg-accent/50' : ''}`}
                  onClick={() => toggleSelect(lead.id)}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{lead.account?.name}</span>
                      <Button size="sm" className="h-7 mt-1 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md w-fit" onClick={(e) => { e.stopPropagation(); handleView(lead); }}>
                        Details
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {batchMeta ? (
                      <BatchChip
                        batch={batchMeta}
                        onClick={onBatchFilterChange}
                        isActive={batchFilter === batchMeta.batch_id}
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><IndustryChip industry={lead.account?.industry} /></TableCell>
                  <TableCell className="text-foreground">{lead.account?.employee_count || '—'}</TableCell>
                  <TableCell>
                    {lead.primaryContact ? (
                      <div className="space-y-0.5">
                        <span className="text-xs font-medium text-foreground truncate max-w-[140px] block">
                          {lead.primaryContact.first_name} {lead.primaryContact.last_name}
                        </span>
                        {lead.primaryContact.title && (
                          <p className="text-[9px] text-muted-foreground truncate max-w-[140px]">{lead.primaryContact.title}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Mail size={10} className={lead.primaryContact.email ? 'text-primary' : 'text-muted-foreground/30'} />
                          <Phone size={10} className={lead.primaryContact.phone ? 'text-primary' : 'text-muted-foreground/30'} />
                          <Linkedin size={10} className={lead.primaryContact.linkedin_url ? 'text-primary' : 'text-muted-foreground/30'} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No contact</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <D365StatusBadge
                      status={d365Status}
                      ownerName={lead.account?.d365_owner_name}
                      d365AccountId={(lead.account as any)?.d365_account_id}
                    />
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.claim_status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lead.claimed_at ? new Date(lead.claimed_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleView(lead)}>
                      <Eye size={12} /> Details
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <AccountDrawer lead={selectedLead} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
