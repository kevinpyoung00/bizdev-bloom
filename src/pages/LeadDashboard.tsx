import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, TrendingUp, MapPin, Globe, Users, Download } from 'lucide-react';

export default function LeadDashboard() {
  const tiles = [
    { label: "Today's 50", value: '0', icon: Target, color: 'text-primary' },
    { label: 'Avg Score', value: '—', icon: TrendingUp, color: 'text-success' },
    { label: 'MA Share', value: '90%', icon: MapPin, color: 'text-info' },
    { label: 'NE Share', value: '8%', icon: MapPin, color: 'text-warning' },
    { label: 'National', value: '2%', icon: Globe, color: 'text-hot' },
    { label: "Today's 5 COIs", value: '0', icon: Users, color: 'text-accent-foreground' },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Engine Dashboard</h1>
            <p className="text-sm text-muted-foreground">MA-first daily lead generation</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-1" /> Export Today's 50
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-1" /> Export COIs
            </Button>
            <Button size="sm">Push All to CRM</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tiles.map(tile => (
            <Card key={tile.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <tile.icon size={16} className={tile.color} />
                  <span className="text-xs text-muted-foreground">{tile.label}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{tile.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick View — Top 10 Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No leads generated yet. Import accounts or wait for the daily 8:00 AM run.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
