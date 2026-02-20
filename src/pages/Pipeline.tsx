import Layout from '@/components/crm/Layout';
import KanbanBoard from '@/components/crm/KanbanBoard';
import DbPipelineBoard from '@/components/crm/DbPipelineBoard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Pipeline() {
  return (
    <Layout>
      <div className="p-6 space-y-4 animate-slide-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Kanban view of your contacts by status</p>
        </div>
        <Tabs defaultValue="db">
          <TabsList>
            <TabsTrigger value="db">Lead Engine Pipeline</TabsTrigger>
            <TabsTrigger value="crm">CRM Pipeline</TabsTrigger>
          </TabsList>
          <TabsContent value="db" className="mt-4">
            <DbPipelineBoard />
          </TabsContent>
          <TabsContent value="crm" className="mt-4">
            <KanbanBoard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
