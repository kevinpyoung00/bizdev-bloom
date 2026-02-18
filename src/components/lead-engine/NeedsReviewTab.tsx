import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, RotateCcw, ExternalLink, Search, CheckCircle2, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';

// D365 deep link helper
function findInD365Url(query: string) {
  // Uses global search — user should replace org/appId via Settings or SOP
  const q = encodeURIComponent(query);
  return `https://org.crm.dynamics.com/main.aspx?pagetype=search&searchText=${q}`;
}

export default function NeedsReviewTab() {
  const queryClient = useQueryClient();
  const reviewEnabled = useFeatureFlag('bizdev_review');

  // Account-level needs review (legacy)
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['needs-review-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, canonical_company_name, domain, d365_owner_name, d365_last_activity, d365_account_id, d365_status, industry, employee_count')
        .eq('needs_review', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Contact-level needs review (bizdev_review)
  const { data: reviewContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['needs-review-contacts'],
    enabled: reviewEnabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts_le')
        .select('id, first_name, last_name, email, title, phone, linkedin_url, account_id, crm_guid, crm_record_url, crm_status, accounts(name, domain)')
        .eq('crm_status', 'needs_review')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
  });

  const returnToQueue = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from('accounts').update({
        needs_review: false, d365_status: 'unowned',
      } as any).eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['needs-review-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast.success('Returned to queue as claimable');
    },
  });

  const claimContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('contacts_le').update({
        crm_status: 'claimed',
      } as any).eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['needs-review-contacts'] });
      toast.success('Contact claimed');
    },
  });

  const rejectContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('contacts_le').update({
        crm_status: 'rejected',
      } as any).eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['needs-review-contacts'] });
      toast.success('Contact rejected');
    },
  });

  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const saveD365Url = useMutation({
    mutationFn: async ({ contactId, url }: { contactId: string; url: string }) => {
      const guidMatch = url.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
      const guid = guidMatch?.[0] || null;
      const { error } = await supabase.from('contacts_le').update({
        crm_record_url: url,
        crm_guid: guid,
      } as any).eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['needs-review-contacts'] });
      setEditingUrlId(null);
      setUrlInput('');
      toast.success('D365 URL saved and GUID extracted');
    },
  });

  const isLoading = loadingAccounts || loadingContacts;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin mr-2" size={16} /> Loading...</div>;
  }

  const hasAccountReview = accounts.length > 0;
  const hasContactReview = reviewEnabled && reviewContacts.length > 0;

  if (!hasAccountReview && !hasContactReview) {
    return <p className="text-center py-12 text-muted-foreground">No records need review.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Contact-level review (bizdev_review) */}
      {reviewEnabled && (
        <div>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Badge variant="outline" className="text-[10px]">Contacts</Badge>
            <span className="text-xs text-muted-foreground">{reviewContacts.length} contacts need D365 resolution</span>
          </div>
          {reviewContacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>D365 Link</TableHead>
                  <TableHead className="w-52">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewContacts.map((c: any) => {
                  const companyName = c.accounts?.name || '—';
                  const searchQuery = c.email || `${c.first_name} ${c.last_name}`;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-medium text-foreground">{c.first_name} {c.last_name}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{companyName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.email || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.title || '—'}</TableCell>
                      <TableCell>
                        {c.crm_record_url ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" asChild>
                            <a href={c.crm_record_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink size={12} /> Open in D365
                            </a>
                          </Button>
                        ) : editingUrlId === c.id ? (
                          <div className="flex gap-1 items-center">
                            <Input
                              value={urlInput}
                              onChange={e => setUrlInput(e.target.value)}
                              placeholder="Paste D365 record URL..."
                              className="h-7 text-xs w-48"
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveD365Url.mutate({ contactId: c.id, url: urlInput })} disabled={!urlInput.trim()}>
                              <Save size={12} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingUrlId(null); setUrlInput(''); }}>
                              <X size={12} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                              <a href={findInD365Url(searchQuery)} target="_blank" rel="noopener noreferrer">
                                <Search size={12} /> Find in D365
                              </a>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingUrlId(c.id); setUrlInput(''); }}>
                              Paste URL
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => claimContact.mutate(c.id)} disabled={claimContact.isPending}>
                            <CheckCircle2 size={12} /> Claim
                          </Button>
                          <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white gap-1" onClick={() => rejectContact.mutate(c.id)} disabled={rejectContact.isPending}>
                            <X size={12} /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-6 text-xs text-muted-foreground">No contacts need D365 resolution.</p>
          )}
        </div>
      )}

      {/* Account-level review (legacy) */}
      {hasAccountReview && (
        <div>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Badge variant="outline" className="text-[10px]">Accounts</Badge>
            <span className="text-xs text-muted-foreground">{accounts.length} accounts need review</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>D365 Owner</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>D365 ID</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-foreground">{a.name}</span>
                      {a.canonical_company_name && (
                        <span className="block text-[10px] text-muted-foreground">{a.canonical_company_name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.domain || '—'}</TableCell>
                  <TableCell className="text-xs text-foreground">{a.d365_owner_name || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.d365_last_activity ? new Date(a.d365_last_activity).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.d365_account_id || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => returnToQueue.mutate(a.id)} disabled={returnToQueue.isPending}>
                        <RotateCcw size={12} className="mr-1" /> Return to Queue
                      </Button>
                      {a.d365_account_id && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                          <a href={`https://dynamics.microsoft.com`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={12} className="mr-1" /> D365
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
