import { useState, useMemo } from 'react';
import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import StatusBadge from '@/components/crm/StatusBadge';
import ContactForm from '@/components/crm/ContactForm';
import ImportContacts from '@/components/crm/ImportContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Download, ArrowUpDown, Upload, ExternalLink, Linkedin, Sparkles, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ContactStatus, getContactProgress } from '@/types/crm';
import { useCompanyEnrich } from '@/hooks/useCompanyEnrich';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ContactsCampaignModal from '@/components/lead-engine/ContactsCampaignModal';

const statuses: (ContactStatus | 'All')[] = ['All', 'Unworked', 'In Sequence', 'Warm', 'Hot', 'Disqualified'];

export default function Contacts() {
  const { contacts, campaigns } = useCrm();
  const navigate = useNavigate();
  const { enrichContactSilent } = useCompanyEnrich();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'All'>('All');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [sortField, setSortField] = useState<'name' | 'company' | 'week' | 'nextTouch'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Fetch DB contacts for batch info
  const { data: dbContacts = [] } = useQuery({
    queryKey: ['contacts-le-batches'],
    queryFn: async () => {
      const { data } = await supabase.from('contacts_le').select('id, batch_id, campaign_tags').not('batch_id', 'is', null);
      return (data || []) as { id: string; batch_id: string; campaign_tags: string[] }[];
    },
  });

  const distinctBatches = useMemo(() => {
    const set = new Set<string>();
    for (const c of dbContacts) {
      if (c.batch_id) set.add(c.batch_id);
    }
    return Array.from(set);
  }, [dbContacts]);

  const unenrichedCount = useMemo(() => contacts.filter(c => !c.companyScrape?.scrapedAt && c.company).length, [contacts]);

  const handleBulkEnrich = async () => {
    const toEnrich = contacts.filter(c => !c.companyScrape?.scrapedAt && c.company);
    if (toEnrich.length === 0) {
      toast.info('All contacts are already enriched');
      return;
    }
    setBulkEnriching(true);
    toast.info(`Enriching ${toEnrich.length} contacts in background...`);
    let done = 0;
    for (const c of toEnrich) {
      await enrichContactSilent(c.id, { website: c.website, company: c.company });
      done++;
      if (done % 5 === 0) toast.info(`Enriched ${done}/${toEnrich.length}...`);
    }
    toast.success(`Enrichment complete — ${done} contacts updated`);
    setBulkEnriching(false);
  };

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') list = list.filter(c => c.status === statusFilter);
    if (campaignFilter !== 'All') list = list.filter(c => c.campaignId === campaignFilter);
    // Batch filter — match by contact id in dbContacts
    if (batchFilter !== 'All') {
      const batchContactIds = new Set(dbContacts.filter(dc => dc.batch_id === batchFilter).map(dc => dc.id));
      list = list.filter(c => batchContactIds.has(c.id));
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`); break;
        case 'company': cmp = a.company.localeCompare(b.company); break;
        case 'week': cmp = a.currentWeek - b.currentWeek; break;
        case 'nextTouch': cmp = (a.nextTouchDate || '').localeCompare(b.nextTouchDate || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [contacts, search, statusFilter, campaignFilter, batchFilter, sortField, sortDir, dbContacts]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const exportCsv = () => {
    const headers = ['First Name', 'Last Name', 'Company', 'Title', 'Role', 'Industry', 'Employees', 'Email', 'LinkedIn', 'Status', 'Week', 'Next Touch'];
    const rows = filtered.map(c => [c.firstName, c.lastName, c.company, c.title, c.rolePersona, c.industry, c.employeeCount, c.email, c.linkedInUrl, c.status, c.currentWeek, c.nextTouchDate]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contacts.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const today = new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <div className="p-6 space-y-4 animate-slide-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} of {contacts.length} contacts</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={() => setCampaignModalOpen(true)}>
                <Users size={16} className="mr-1" /> Add Selected to Campaign
                <Badge variant="secondary" className="ml-1 text-[10px]">{selectedIds.size}</Badge>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv}><Download size={16} className="mr-1" /> Export</Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><Upload size={16} className="mr-1" /> Import</Button>
            {unenrichedCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleBulkEnrich} disabled={bulkEnriching}>
                {bulkEnriching ? <><Loader2 size={16} className="mr-1 animate-spin" /> Enriching...</> : <><Sparkles size={16} className="mr-1" /> Enrich All ({unenrichedCount})</>}
              </Button>
            )}
            <Button size="sm" onClick={() => setShowForm(true)}><Plus size={16} className="mr-1" /> Add Contact</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Campaigns" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Campaigns</SelectItem>
              {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {distinctBatches.length > 0 && (
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Batches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Batches</SelectItem>
                {distinctBatches.map(b => (
                  <SelectItem key={b} value={b}>{b.slice(0, 8)}…</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-3 w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </th>
                  {[
                    { key: 'name' as const, label: 'Name' },
                    { key: 'company' as const, label: 'Company' },
                  ].map(col => (
                    <th key={col.key} className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort(col.key)}>
                      <span className="flex items-center gap-1">{col.label} <ArrowUpDown size={12} /></span>
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Industry</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('week')}>
                    <span className="flex items-center gap-1">Week <ArrowUpDown size={12} /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('nextTouch')}>
                    <span className="flex items-center gap-1">Next Touch <ArrowUpDown size={12} /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Progress</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No contacts found. Add your first contact to get started.</td></tr>
                )}
                {filtered.map(contact => {
                  const campaign = campaigns.find(c => c.id === contact.campaignId);
                  const progress = getContactProgress(contact);
                  const isOverdue = contact.status === 'In Sequence' && contact.nextTouchDate < today;
                  return (
                    <tr
                      key={contact.id}
                      className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${selectedIds.has(contact.id) ? 'bg-accent/50' : ''}`}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(contact.id)} onCheckedChange={() => toggleSelect(contact.id)} />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground" onClick={() => navigate(`/contacts/${contact.id}`)}>
                        <div className="flex items-center gap-2">
                          <span>{contact.firstName} {contact.lastName}</span>
                          {contact.linkedInUrl && (
                            <a
                              href={contact.linkedInUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="LinkedIn Profile"
                            >
                              <Linkedin size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground" onClick={() => navigate(`/contacts/${contact.id}`)}>
                        {contact.company ? (
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(contact.company)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/search?q=${encodeURIComponent(contact.company)}`, '_blank'); e.preventDefault(); }}
                            className="hover:text-primary hover:underline transition-colors inline-flex items-center gap-1"
                          >
                            {contact.company}
                            <ExternalLink size={12} className="text-muted-foreground" />
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.rolePersona}</td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.industry}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{campaign?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">W{contact.currentWeek}</span>
                      </td>
                      <td className={`px-4 py-3 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {contact.nextTouchDate || '—'}
                        {isOverdue && ' ⚠'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={contact.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ContactForm open={showForm} onOpenChange={setShowForm} />
        <ImportContacts open={showImport} onOpenChange={setShowImport} />
        <ContactsCampaignModal
          open={campaignModalOpen}
          onOpenChange={setCampaignModalOpen}
          selectedContactIds={Array.from(selectedIds)}
          onComplete={() => setSelectedIds(new Set())}
          isCrmContacts
        />
      </div>
    </Layout>
  );
}
