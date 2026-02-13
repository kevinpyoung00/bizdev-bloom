import { useCrm } from '@/store/CrmContext';
import { ContactStatus } from '@/types/crm';
import StatusBadge from '@/components/crm/StatusBadge';
import { useNavigate } from 'react-router-dom';
import { getContactProgress } from '@/types/crm';

const columns: ContactStatus[] = ['Unworked', 'In Sequence', 'Warm', 'Hot', 'Disqualified'];
const columnColors: Record<ContactStatus, string> = {
  'Unworked': 'border-t-muted-foreground',
  'In Sequence': 'border-t-info',
  'Warm': 'border-t-warning',
  'Hot': 'border-t-hot',
  'Disqualified': 'border-t-destructive',
};

export default function KanbanBoard() {
  const { contacts, setContactStatus } = useCrm();
  const navigate = useNavigate();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(status => {
        const items = contacts.filter(c => c.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-72">
            <div className={`bg-card rounded-lg border border-border border-t-4 ${columnColors[status]}`}>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm text-card-foreground">{status}</h3>
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No contacts</p>
                )}
                {items.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    className="bg-background rounded-md border border-border p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <p className="font-medium text-sm text-foreground">{contact.firstName} {contact.lastName}</p>
                    <p className="text-xs text-muted-foreground">{contact.company}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">Week {contact.currentWeek}</span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${getContactProgress(contact)}%` }} />
                      </div>
                    </div>
                    {contact.nextTouchDate && (
                      <p className={`text-xs mt-1 ${
                        contact.nextTouchDate < new Date().toISOString().split('T')[0]
                          ? 'text-destructive font-medium'
                          : 'text-muted-foreground'
                      }`}>
                        Next: {contact.nextTouchDate}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
