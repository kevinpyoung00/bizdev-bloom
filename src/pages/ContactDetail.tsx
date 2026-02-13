import { useParams, useNavigate } from 'react-router-dom';
import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import StatusBadge from '@/components/crm/StatusBadge';
import WeekPanel from '@/components/crm/WeekPanel';
import ContactForm from '@/components/crm/ContactForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Mail, Linkedin, ExternalLink, Edit2, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { getContactProgress } from '@/types/crm';
import { useState } from 'react';

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contacts, campaigns, bookMeeting, setContactStatus, reactivateContact } = useCrm();
  const [editing, setEditing] = useState(false);

  const contact = contacts.find(c => c.id === id);
  if (!contact) return <Layout><div className="p-6"><p className="text-muted-foreground">Contact not found.</p><Button variant="outline" onClick={() => navigate('/contacts')}>Back</Button></div></Layout>;

  const campaign = campaigns.find(c => c.id === contact.campaignId);
  const progress = getContactProgress(contact);
  const presets = campaign?.weeklyPresets || [];

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/contacts')}>
              <ArrowLeft size={16} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{contact.firstName} {contact.lastName}</h1>
              <p className="text-sm text-muted-foreground">{contact.title} at {contact.company}</p>
            </div>
            <StatusBadge status={contact.status} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 size={14} className="mr-1" /> Edit</Button>
            {contact.status !== 'Hot' && (
              <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => bookMeeting(contact.id)}>
                <Trophy size={14} className="mr-1" /> Meeting Booked
              </Button>
            )}
            {contact.status !== 'Disqualified' && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setContactStatus(contact.id, 'Disqualified')}>
                <XCircle size={14} className="mr-1" /> Disqualify
              </Button>
            )}
            {(contact.status === 'Disqualified' || contact.status === 'Hot') && (
              <Button variant="outline" size="sm" onClick={() => reactivateContact(contact.id)}>
                <RotateCcw size={14} className="mr-1" /> Re-activate
              </Button>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold text-sm text-card-foreground">Contact Info</h3>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Role: <span className="text-foreground">{contact.rolePersona}</span></p>
              <p className="text-muted-foreground">Industry: <span className="text-foreground">{contact.industry}</span></p>
              <p className="text-muted-foreground">Employees: <span className="text-foreground">{contact.employeeCount}</span></p>
              <p className="text-muted-foreground">Source: <span className="text-foreground">{contact.source}</span></p>
              {contact.renewalMonth && <p className="text-muted-foreground">Renewal: <span className="text-foreground">{contact.renewalMonth}</span></p>}
            </div>
            <div className="flex gap-2 pt-2">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="text-primary hover:text-primary/80 text-xs flex items-center gap-1">
                  <Mail size={12} /> {contact.email}
                </a>
              )}
            </div>
            {contact.linkedInUrl && (
              <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 text-xs flex items-center gap-1">
                <Linkedin size={12} /> LinkedIn Profile <ExternalLink size={10} />
              </a>
            )}
          </div>

          <div className="bg-card rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold text-sm text-card-foreground">Sequence Status</h3>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Campaign: <span className="text-foreground">{campaign?.name || 'None'}</span></p>
              <p className="text-muted-foreground">Current Week: <span className="text-foreground font-bold">{contact.currentWeek} / 12</span></p>
              <p className="text-muted-foreground">Start Date: <span className="text-foreground">{contact.startDate}</span></p>
              <p className="text-muted-foreground">Last Touch: <span className="text-foreground">{contact.lastTouchDate || '—'}</span></p>
              <p className="text-muted-foreground">Next Touch: <span className={`font-medium ${contact.nextTouchDate < new Date().toISOString().split('T')[0] ? 'text-destructive' : 'text-foreground'}`}>{contact.nextTouchDate || '—'}</span></p>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold text-sm text-card-foreground mb-2">Progress</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-lg font-bold text-foreground">{progress}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{contact.touchLogs.length} total touches logged</p>
            {contact.notes && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Notes:</p>
                <p className="text-sm text-foreground">{contact.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* 12-Week Workflow */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Calendar size={18} /> 12-Week Drip Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, i) => {
              const week = i + 1;
              const wp = contact.weekProgress[i];
              const preset = presets[i] || { emailTheme: '', linkedInTouch: '', cta: '', asset: '', callObjective: '', callTalkTrack: '', voicemailScript: '' };
              return (
                <WeekPanel
                  key={week}
                  contactId={contact.id}
                  week={week}
                  emailTheme={preset.emailTheme}
                  linkedInTouch={preset.linkedInTouch}
                  cta={preset.cta}
                  asset={preset.asset}
                  callObjective={preset.callObjective}
                  callTalkTrack={preset.callTalkTrack}
                  voicemailScript={preset.voicemailScript}
                  liDone={wp.liDone}
                  emailDone={wp.emailDone}
                  phoneDone={wp.phoneDone}
                  outcome={wp.outcome}
                  notes={wp.notes}
                  isCurrent={week === contact.currentWeek}
                  isPast={week < contact.currentWeek}
                />
              );
            })}
          </div>
        </div>

        {/* Touch Log */}
        {contact.touchLogs.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-3">Touch Log</h3>
            <div className="space-y-2">
              {contact.touchLogs.slice().reverse().map(log => (
                <div key={log.id} className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground w-20">{log.date}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${log.channel === 'LinkedIn' ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary'}`}>{log.channel}</span>
                  <span className="text-muted-foreground">Week {log.weekNum}</span>
                  <span className="text-muted-foreground">Touch #{log.touchNum}</span>
                  {log.outcome && <span className="text-xs text-foreground">{log.outcome}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <ContactForm open={editing} onOpenChange={setEditing} editContact={contact} />
      </div>
    </Layout>
  );
}
