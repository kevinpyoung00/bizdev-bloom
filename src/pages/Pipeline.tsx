import Layout from '@/components/crm/Layout';
import KanbanBoard from '@/components/crm/KanbanBoard';

export default function Pipeline() {
  return (
    <Layout>
      <div className="p-6 space-y-4 animate-slide-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Kanban view of your contacts by status</p>
        </div>
        <KanbanBoard />
      </div>
    </Layout>
  );
}
