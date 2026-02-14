import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function LeadSettings() {
  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Engine Settings</h1>
          <p className="text-sm text-muted-foreground">Dual 3-star scoring model: Signal Stars + Reachability Stars + Priority Label</p>
        </div>

        {/* Signal Stars */}
        <Card>
          <CardHeader>
            <CardTitle>Signal Stars (1–3) — <span style={{ color: '#FFA500' }}>★★★</span></CardTitle>
            <CardDescription>Based on timing/disruption events. Determines the Priority Label.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Large Signals (auto ★★★)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-border rounded-lg p-3">
                  <span className="text-sm font-medium text-foreground">HR/Benefits Role Change</span>
                  <p className="text-xs text-muted-foreground mt-1">≤14 days ago</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <span className="text-sm font-medium text-foreground">Hiring Velocity</span>
                  <p className="text-xs text-muted-foreground mt-1">10+ job postings in 60 days</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <span className="text-sm font-medium text-foreground">Funding Event</span>
                  <p className="text-xs text-muted-foreground mt-1">≤90 days ago</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Medium Signals</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border rounded-lg p-3">
                  <span className="text-sm font-medium text-foreground">HR/Benefits Role Change</span>
                  <p className="text-xs text-muted-foreground mt-1">15–60 days ago</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <span className="text-sm font-medium text-foreground">Hiring Velocity</span>
                  <p className="text-xs text-muted-foreground mt-1">6–9 job postings</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <span className="text-sm font-medium text-foreground">Funding Event</span>
                  <p className="text-xs text-muted-foreground mt-1">91–180 days ago</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <span className="text-sm font-medium text-foreground">C-Suite Movement</span>
                  <p className="text-xs text-muted-foreground mt-1">≤90 days ago (never Large)</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Star Logic</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><span style={{ color: '#FFA500' }}>★★★</span> = 1 Large OR 2 Medium OR 1 Medium + Reachable (email or phone)</li>
                <li><span style={{ color: '#FFA500' }}>★★☆</span> = 1 Medium OR 2 Small</li>
                <li><span style={{ color: '#FFA500' }}>★☆☆</span> = 1 Small OR ICP-only</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Reachability Stars */}
        <Card>
          <CardHeader>
            <CardTitle>Reachability Stars (0–3) — <span style={{ color: '#1E90FF' }}>★★★</span></CardTitle>
            <CardDescription>Based on available contact channels. Does NOT affect the Priority Label.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><span style={{ color: '#1E90FF' }}>★★★</span> = Email + Phone + LinkedIn</li>
              <li><span style={{ color: '#1E90FF' }}>★★☆</span> = Any two channels</li>
              <li><span style={{ color: '#1E90FF' }}>★☆☆</span> = Only one channel</li>
              <li><span style={{ color: '#1E90FF' }}>☆☆☆</span> = None</li>
            </ul>
          </CardContent>
        </Card>

        {/* Priority Label */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Label</CardTitle>
            <CardDescription>Derived solely from Signal Stars. Displayed as a colored badge.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Badge variant="outline" className="bg-orange-500/15 text-orange-600 border-orange-500/30">HIGH PRIORITY</Badge>
              <Badge variant="outline" className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">MEDIUM PRIORITY</Badge>
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">LOW PRIORITY</Badge>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside mt-3">
              <li>High = ★★★ Signal Stars</li>
              <li>Medium = ★★ Signal Stars</li>
              <li>Low = ★ Signal Stars</li>
            </ul>
          </CardContent>
        </Card>

        {/* Geography Gates */}
        <Card>
          <CardHeader>
            <CardTitle>Geography Selection Gates</CardTitle>
            <CardDescription>MA accounts fill first. NE/National require ★★★ Signal Stars.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>MA Slots</Label>
                <Input type="number" defaultValue={45} disabled />
                <p className="text-xs text-muted-foreground mt-1">Top 45, no minimum</p>
              </div>
              <div>
                <Label>NE Slots</Label>
                <Input type="number" defaultValue={4} disabled />
                <p className="text-xs text-muted-foreground mt-1">Up to 4, must be ★★★</p>
              </div>
              <div>
                <Label>National Slots</Label>
                <Input type="number" defaultValue={1} disabled />
                <p className="text-xs text-muted-foreground mt-1">Up to 1, must be ★★★</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardrails */}
        <Card>
          <CardHeader>
            <CardTitle>Guardrails</CardTitle>
            <CardDescription>Accounts matching these conditions are excluded from the daily queue</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Missing domain → <Badge variant="outline" className="text-[10px]">missing_domain</Badge></li>
              <li>Disposition = suppressed → excluded entirely</li>
              <li>Disposition starts with rejected_ → excluded entirely</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
