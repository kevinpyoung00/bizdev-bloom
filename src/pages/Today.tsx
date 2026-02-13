import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import StatusBadge from '@/components/crm/StatusBadge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, ChevronRight, Timer } from 'lucide-react';

export default function Today() {
  const { contacts, campaigns, snoozeContact } = useCrm();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const overdue = contacts.filter(c => c.status === 'In Sequence' && c.nextTouchDate < today);
  const dueToday = contacts.filter(c => c.status === 'In Sequence' && c.nextTouchDate === today);
  const upcoming3 = contacts.filter(c => {
    if (c.status !== 'In Sequence') return false;
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const in3 = d.toISOString().split('T')[0];
    return c.nextTouchDate > today && c.nextTouchDate <= in3;
  });

  const renderTaskCard = (contact: typeof contacts[0], isOverdue: boolean) => {
    const campaign = campaigns.find(c => c.id === contact.campaignId);
    const preset = campaign?.weeklyPresets?.[contact.currentWeek - 1];
    const wp = contact.weekProgress[contact.currentWeek - 1];

    return (
      <div key={contact.id} className={`bg-card rounded-lg border p-4 transition-all hover:shadow-sm ${isOverdue ? 'border-destructive/30' : 'border-border'}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-foreground">{contact.firstName} {contact.lastName}</span>
              <StatusBadge status={contact.status} />
              {isOverdue && <span className="text-xs text-destructive flex items-center gap-1"><AlertTriangle size={12} /> Overdue</span>}
            </div>
            <p className="text-xs text-muted-foreground">{contact.company} · {contact.rolePersona}</p>
            <div className="mt-2 text-xs space-y-1">
              <p className="text-muted-foreground">Week {contact.currentWeek} · {campaign?.name || 'No campaign'}</p>
              {preset && (
                <>
                  {!wp?.liDone && <p className="text-info">📱 LI: {preset.linkedInTouch}</p>}
                  {!wp?.emailDone && <p className="text-primary">📧 Email: {preset.emailTheme}</p>}
                </>
              )}
              <p className="text-muted-foreground">Next touch: {contact.nextTouchDate}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate(`/contacts/${contact.id}`)}>
              Open <ChevronRight size={12} />
            </Button>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => snoozeContact(contact.id, 1)} title="Snooze 1 day">
                <Timer size={10} /> 1d
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => snoozeContact(contact.id, 3)} title="Snooze 3 days">
                <Timer size={10} /> 3d
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => snoozeContact(contact.id, 7)} title="Snooze 7 days">
                <Timer size={10} /> 7d
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-slide-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Today's Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {overdue.length + dueToday.length} tasks due · {overdue.length} overdue
          </p>
        </div>

        {/* Overdue */}
        {overdue.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-3">
              <AlertTriangle size={16} /> Overdue ({overdue.length})
            </h2>
            <div className="space-y-2">
              {overdue.map(c => renderTaskCard(c, true))}
            </div>
          </div>
        )}

        {/* Due Today */}
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Clock size={16} /> Due Today ({dueToday.length})
          </h2>
          {dueToday.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card rounded-lg border border-border p-8 text-center">
              No tasks due today. You're all caught up! 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {dueToday.map(c => renderTaskCard(c, false))}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming3.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
              Next 3 Days ({upcoming3.length})
            </h2>
            <div className="space-y-2">
              {upcoming3.map(c => renderTaskCard(c, false))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
