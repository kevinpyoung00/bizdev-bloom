import Layout from '@/components/crm/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Send } from 'lucide-react';

export default function COIQueue() {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">COI Queue</h1>
            <p className="text-sm text-muted-foreground">Today's 5 Centers of Influence — MA & NE biased</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-1" /> Export COIs CSV
            </Button>
            <Button size="sm">
              <Send size={16} className="mr-1" /> Push to CRM
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead className="w-16">Score</TableHead>
                  <TableHead>Firm</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Best Contact</TableHead>
                  <TableHead>Mutuals</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No COIs yet. Import COI data or wait for the daily run.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
