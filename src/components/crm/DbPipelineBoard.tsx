import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { PIPELINE_STAGES, PIPELINE_COLORS } from '@/hooks/usePipelineUpdate';
import { Badge } from '@/components/ui/badge';

const STAGE_BORDER_COLORS: Record<number, string> = {
  0: 'border-t-muted-foreground',
  1: 'border-t-primary',
  2: 'border-t-info',
  3: 'border-t-warning',
  4: 'border-t-success',
};

export default function DbPipelineBoard() {
  const navigate = useNavigate();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['db-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts_le')
        .select('id, first_name, last_name, title, account_id, pipeline_stage, last_touch, next_touch, campaign_tags')
        .order('next_touch', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const accountIds = [...new Set((data || []).map(c => c.account_id).filter(Boolean))] as string[];
      let accountMap = new Map<string, string>();
      if (accountIds.length > 0) {
        const { data: accounts } = await supabase.from('accounts').select('id, name').in('id', accountIds);
        for (const a of accounts || []) accountMap.set(a.id, a.name);
      }

      return (data || []).map(c => ({
        ...c,
        account_name: accountMap.get(c.account_id || '') || '—',
        pipeline_stage: c.pipeline_stage ?? 0,
      }));
    },
  });

  const stages = [0, 1, 2, 3, 4];
  const today = new Date().toISOString().split('T')[0];

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading pipeline…</p>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map(stage => {
        const items = contacts.filter(c => c.pipeline_stage === stage);
        return (
          <div key={stage} className="flex-shrink-0 w-72">
            <div className={`bg-card rounded-lg border border-border border-t-4 ${STAGE_BORDER_COLORS[stage] || ''}`}>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm text-card-foreground">{PIPELINE_STAGES[stage]}</h3>
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No contacts</p>
                )}
                {items.map(contact => (
                  <div
                    key={contact.id}
                    className="bg-background rounded-md border border-border p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <p className="font-medium text-sm text-foreground">{contact.first_name} {contact.last_name}</p>
                    <p className="text-xs text-muted-foreground">{contact.account_name}</p>
                    {contact.title && (
                      <p className="text-xs text-muted-foreground mt-0.5">{contact.title}</p>
                    )}
                    {contact.next_touch && (
                      <p className={`text-xs mt-1 ${
                        contact.next_touch.split('T')[0] <= today
                          ? 'text-destructive font-medium'
                          : 'text-muted-foreground'
                      }`}>
                        Next: {new Date(contact.next_touch).toLocaleDateString()}
                      </p>
                    )}
                    {((contact.campaign_tags as string[]) || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {((contact.campaign_tags as string[]) || []).slice(0, 2).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{tag}</Badge>
                        ))}
                      </div>
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
