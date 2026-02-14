import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export default function LeadSettings() {
  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Engine Settings</h1>
          <p className="text-sm text-muted-foreground">Configure ICP, scoring weights, geography allocation, and CRM connection</p>
        </div>

        {/* Scoring Weights */}
        <Card>
          <CardHeader>
            <CardTitle>Scoring Weights</CardTitle>
            <CardDescription>Adjust how each factor contributes to the lead score (total should equal 100)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: 'Industry Fit', value: 18 },
              { label: 'Employee Size Fit', value: 18 },
              { label: 'Geography Fit', value: 24 },
              { label: 'Hiring Velocity', value: 20 },
              { label: 'C-Suite Movement', value: 12 },
              { label: 'Funding / Expansion', value: 8 },
            ].map(w => (
              <div key={w.label} className="flex items-center gap-4">
                <span className="text-sm w-40 text-foreground">{w.label}</span>
                <Slider defaultValue={[w.value]} max={40} step={1} className="flex-1" />
                <span className="text-sm font-medium w-8 text-right text-muted-foreground">{w.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Geography Allocation */}
        <Card>
          <CardHeader>
            <CardTitle>Geography Allocation</CardTitle>
            <CardDescription>Daily lead slot distribution and minimum score gates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>MA Slots (%)</Label>
                <Input type="number" defaultValue={90} />
              </div>
              <div>
                <Label>NE Slots (%)</Label>
                <Input type="number" defaultValue={8} />
              </div>
              <div>
                <Label>National Slots (%)</Label>
                <Input type="number" defaultValue={2} />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>NE Minimum Score Gate</Label>
                <Input type="number" defaultValue={85} />
              </div>
              <div>
                <Label>National Minimum Score Gate</Label>
                <Input type="number" defaultValue={90} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CRM Connection */}
        <Card>
          <CardHeader>
            <CardTitle>CRM Connection</CardTitle>
            <CardDescription>Auto-push settings for bizdev-bloom</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-Push Enabled</p>
                <p className="text-xs text-muted-foreground">Automatically push daily leads to CRM at 8:00 AM ET</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-3">
              <div>
                <Label>API Base URL</Label>
                <Input defaultValue="https://bizdev-bloom.lovable.app/api" disabled className="text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">API Key and HMAC Secret are stored securely as backend secrets.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
