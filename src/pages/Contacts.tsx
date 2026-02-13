import { useState, useMemo } from 'react';
import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import StatusBadge from '@/components/crm/StatusBadge';
import ContactForm from '@/components/crm/ContactForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Download, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ContactStatus, getContactProgress } from '@/types/crm';

const statuses: (ContactStatus | 'All')[] = ['All', 'Unworked', 'In Sequence', 'Warm', 'Hot', 'Disqualified'];

export default function Contacts() {
  const { contacts, campaigns } = useCrm();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'All'>('All');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [sortField, setSortField] = useState<'name' | 'company' | 'week' | 'nextTouch'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
  }, [contacts, search, statusFilter, campaignFilter, sortField, sortDir]);

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

  const today = new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <div className="p-6 space-y-4 animate-slide-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} of {contacts.length} contacts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download size={16} className="mr-1" /> Export</Button>
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
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
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
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No contacts found. Add your first contact to get started.</td></tr>
                )}
                {filtered.map(contact => {
                  const campaign = campaigns.find(c => c.id === contact.campaignId);
                  const progress = getContactProgress(contact);
                  const isOverdue = contact.status === 'In Sequence' && contact.nextTouchDate < today;
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{contact.firstName} {contact.lastName}</td>
                      <td className="px-4 py-3 text-foreground">{contact.company}</td>
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
      </div>
    </Layout>
  );
}
