import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, ExternalLink, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function NeedsReviewTab() {
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
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

  const returnToQueue = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from('accounts').update({
        needs_review: false,
        d365_status: 'unowned',
      } as any).eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['needs-review-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast.success('Returned to queue as claimable');
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin mr-2" size={16} /> Loading...</div>;
  }

  if (accounts.length === 0) {
    return <p className="text-center py-12 text-muted-foreground">No accounts need review.</p>;
  }

  return (
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
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={() => returnToQueue.mutate(a.id)}
                  disabled={returnToQueue.isPending}
                >
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
  );
}
