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
          <p className="text-sm text-muted-foreground">Priority Outreach Score breakdown and geography gate configuration</p>
        </div>

        {/* Scoring Model Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Outreach Score (0–100)</CardTitle>
            <CardDescription>Raw score out of 110 is normalized to 0–100. Geography is a selection gate, not a scoring factor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fit (0–40 pts)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Industry</span>
                    <Badge variant="outline" className="text-[10px]">0–20</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Healthcare (20), Biotech (18), Professional Services (16), Manufacturing (14), Higher Ed (12), deprioritized industries (2), unknown (5)</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Company Size</span>
                    <Badge variant="outline" className="text-[10px]">0–20</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">50–250 (20), 250–500 (14), 25–50 (12), 500–1000 (6), 1000+ (2), &lt;25 (2)</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Timing (0–60 pts)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Hiring Velocity</span>
                    <Badge variant="outline" className="text-[10px]">0–25</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">10+ open roles in 60d = 25 pts, scales linearly below</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">C-Suite Changes</span>
                    <Badge variant="outline" className="text-[10px]">0–20</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">≤3mo (20), ≤6mo (12), ≤12mo (6)</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Recent Role Changes</span>
                    <Badge variant="outline" className="text-[10px]">0–10</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Non-C-suite HR/Finance/Benefits roles: ≤14d (10), ≤30d (7), ≤60d (4)</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Funding / Expansion</span>
                    <Badge variant="outline" className="text-[10px]">0–5</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Recent funding: ≤3mo (5), ≤6mo (4), ≤12mo (3)</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Reachability (0–10 pts)</p>
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">Contact Data Quality</span>
                  <Badge variant="outline" className="text-[10px]">0–10</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Email (4), Phone (2), 2+ LinkedIn (2), CFO/CHRO contact (2)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geography Gates */}
        <Card>
          <CardHeader>
            <CardTitle>Geography Selection Gates</CardTitle>
            <CardDescription>Geography determines slot allocation, not scoring. MA accounts fill first, then NE/National if they exceed score thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>MA Slots</Label>
                <Input type="number" defaultValue={45} disabled />
                <p className="text-xs text-muted-foreground mt-1">Top 45, no minimum score</p>
              </div>
              <div>
                <Label>NE Slots</Label>
                <Input type="number" defaultValue={4} disabled />
                <p className="text-xs text-muted-foreground mt-1">Up to 4 if score ≥ 85</p>
              </div>
              <div>
                <Label>National Slots</Label>
                <Input type="number" defaultValue={1} disabled />
                <p className="text-xs text-muted-foreground mt-1">Up to 1 if score ≥ 90</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardrails */}
        <Card>
          <CardHeader>
            <CardTitle>Guardrails</CardTitle>
            <CardDescription>Accounts matching these conditions are scored at 0 and excluded from the daily queue</CardDescription>
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
