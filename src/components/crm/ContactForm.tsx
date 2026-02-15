import { useState } from 'react';
import { Contact, RolePersona, ContactSource, ContactStatus, FundingStage, CSuiteRole, TriggerTag, ContactSignals, createEmptySignals, getHiringIntensity, isHrChangeRecent } from '@/types/crm';
import { useCrm } from '@/store/CrmContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const roles: RolePersona[] = ['CEO', 'Founder', 'CFO', 'COO', 'CHRO', 'HR', 'Benefits Leader', 'Finance', 'Ops', 'Other'];
const sources: ContactSource[] = ['Sales Navigator', 'ZoomInfo', 'Zywave', 'List Upload'];
const statuses: ContactStatus[] = ['Unworked', 'In Sequence', 'Warm', 'Hot', 'Disqualified'];
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fundingStages: FundingStage[] = ['None','Seed','Series A','Series B','Series C+','Private Equity','Venture Debt'];
const csuiteRoles: CSuiteRole[] = ['CEO','CFO','COO','CHRO','Other'];
const triggerTags: TriggerTag[] = ['New location','M&A','Restructure','Layoffs','New product launch','Approaching headcount milestone'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editContact?: Contact;
}

export default function ContactForm({ open, onOpenChange, editContact }: Props) {
  const { addContact, updateContact, campaigns } = useCrm();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    firstName: editContact?.firstName || '',
    lastName: editContact?.lastName || '',
    company: editContact?.company || '',
    title: editContact?.title || '',
    rolePersona: editContact?.rolePersona || 'CEO' as RolePersona,
    industry: editContact?.industry || '',
    employeeCount: editContact?.employeeCount || '',
    email: editContact?.email || '',
    linkedInUrl: editContact?.linkedInUrl || '',
    phone: editContact?.phone || '',
    source: editContact?.source || 'Sales Navigator' as ContactSource,
    renewalMonth: editContact?.renewalMonth || '',
    campaignId: editContact?.campaignId || '',
    status: editContact?.status || 'Unworked' as ContactStatus,
    startDate: editContact?.startDate || today,
    notes: editContact?.notes || '',
  });

  const [signals, setSignals] = useState<ContactSignals>(editContact?.signals || createEmptySignals());

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const setSig = <K extends keyof ContactSignals>(key: K, value: ContactSignals[K]) => setSignals(prev => ({ ...prev, [key]: value }));

  const toggleTrigger = (tag: TriggerTag) => {
    setSignals(prev => ({
      ...prev,
      triggers: prev.triggers.includes(tag) ? prev.triggers.filter(t => t !== tag) : [...prev.triggers, tag],
    }));
  };

  const hiringIntensity = getHiringIntensity(signals.jobs_60d);
  const hrRecent = isHrChangeRecent(signals.hr_change_days_ago);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, signals };
    if (editContact) {
      updateContact(editContact.id, payload);
    } else {
      addContact(payload as any);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
            </div>
            <div>
              <Label>Company *</Label>
              <Input value={form.company} onChange={e => set('company', e.target.value)} required />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div>
              <Label>Role Persona</Label>
              <Select value={form.rolePersona} onValueChange={v => set('rolePersona', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Industry</Label>
              <Input value={form.industry} onChange={e => set('industry', e.target.value)} />
            </div>
            <div>
              <Label>Employee Count</Label>
              <Input value={form.employeeCount} onChange={e => set('employeeCount', e.target.value)} placeholder="e.g. 50-250" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedInUrl} onChange={e => set('linkedInUrl', e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => set('source', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Renewal Month</Label>
              <Select value={form.renewalMonth} onValueChange={v => set('renewalMonth', v)}>
                <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campaign</Label>
              <Select value={form.campaignId} onValueChange={v => set('campaignId', v)}>
                <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent>
                  {campaigns.filter(c => c.active).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
          </div>

          {/* Company Signals Section */}
          <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
            <h3 className="font-semibold text-sm text-foreground">Company Signals</h3>

            {/* Funding Event */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Funding Event</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Funding Stage</Label>
                  <Select value={signals.funding_stage} onValueChange={v => setSig('funding_stage', v as FundingStage)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{fundingStages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Days Ago</Label>
                  <Input type="number" min={0} placeholder="e.g. 30" value={signals.funding_days_ago ?? ''} onChange={e => setSig('funding_days_ago', e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
            </div>

            {/* HR Role Change */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">HR / Benefits Leadership Change</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">New Title</Label>
                  <Input placeholder="e.g. VP of People" value={signals.hr_change_title} onChange={e => setSig('hr_change_title', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Days Ago</Label>
                  <Input type="number" min={0} placeholder="e.g. 14" value={signals.hr_change_days_ago ?? ''} onChange={e => setSig('hr_change_days_ago', e.target.value ? Number(e.target.value) : null)} />
                  {signals.hr_change_days_ago != null && (
                    <p className={`text-[10px] mt-0.5 ${hrRecent ? 'text-success' : 'text-muted-foreground'}`}>
                      {hrRecent ? '✓ Recent (≤60 days)' : 'Not recent (>60 days)'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* C-Suite Change */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">C-Suite Change</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select value={signals.csuite_role || '_none'} onValueChange={v => setSig('csuite_role', v === '_none' ? '' : v as CSuiteRole)}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {csuiteRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Days Ago</Label>
                  <Input type="number" min={0} placeholder="e.g. 45" value={signals.csuite_days_ago ?? ''} onChange={e => setSig('csuite_days_ago', e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
            </div>

            {/* Hiring Velocity */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hiring Velocity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Job Postings (last 60 days)</Label>
                  <Input type="number" min={0} placeholder="e.g. 12" value={signals.jobs_60d ?? ''} onChange={e => setSig('jobs_60d', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="flex items-end">
                  {hiringIntensity && (
                    <Badge variant={hiringIntensity === 'Large' ? 'destructive' : hiringIntensity === 'Medium' ? 'default' : 'secondary'}>
                      {hiringIntensity} Intensity
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Other Triggers */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Other Triggers</p>
              <div className="flex flex-wrap gap-2">
                {triggerTags.map(tag => (
                  <label key={tag} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={signals.triggers.includes(tag)} onCheckedChange={() => toggleTrigger(tag)} />
                    {tag}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editContact ? 'Save Changes' : 'Add Contact'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
