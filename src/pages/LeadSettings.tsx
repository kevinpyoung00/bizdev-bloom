import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useIndustrySettings } from '@/hooks/useLeadActions';
import { Loader2 } from 'lucide-react';
import KeywordListEditor from '@/components/lead-engine/KeywordListEditor';

export default function LeadSettings() {
  const { data: industries = [], isLoading } = useIndustrySettings();

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Engine Settings</h1>
          <p className="text-sm text-muted-foreground">Dual 3-star scoring · D365 compliance flow · 12-week drip cadence</p>
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
                {[
                  ['HR/Benefits Role Change', '≤14 days ago'],
                  ['Hiring Velocity', '10+ job postings in 60 days'],
                  ['Funding Event', '≤90 days ago'],
                ].map(([name, desc]) => (
                  <div key={name} className="border border-border rounded-lg p-3">
                    <span className="text-sm font-medium text-foreground">{name}</span>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Star Logic</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><span style={{ color: '#FFA500' }}>★★★</span> = 1 Large OR 2 Medium OR 1 Medium + Reachable</li>
                <li><span style={{ color: '#FFA500' }}>★★☆</span> = 1 Medium OR 2 Small</li>
                <li><span style={{ color: '#FFA500' }}>★☆☆</span> = 1 Small OR ICP-only</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Reachability */}
        <Card>
          <CardHeader>
            <CardTitle>Reachability Stars (0–3) — <span style={{ color: '#1E90FF' }}>★★★</span></CardTitle>
            <CardDescription>Does NOT affect the Priority Label.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><span style={{ color: '#1E90FF' }}>★★★</span> = Email + Phone + LinkedIn</li>
              <li><span style={{ color: '#1E90FF' }}>★★☆</span> = Any two</li>
              <li><span style={{ color: '#1E90FF' }}>★☆☆</span> = One</li>
              <li><span style={{ color: '#1E90FF' }}>☆☆☆</span> = None</li>
            </ul>
          </CardContent>
        </Card>

        {/* Status Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Status Flow</CardTitle>
            <CardDescription>D365 compliance: Claim → Export → Upload → Campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-center">
              {['New', 'Claimed', 'Uploaded to D365', 'In Campaign', 'Rejected'].map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">{s}</Badge>
                  {i < 4 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Industries */}
        <Card>
          <CardHeader>
            <CardTitle>Active Industries</CardTitle>
            <CardDescription>Leads not matching these use General Exec messaging</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <div className="space-y-2">
                {industries.map((ind: any) => (
                  <div key={ind.id} className="flex items-center gap-3 border border-border rounded-lg p-3">
                    <span className="text-sm font-medium text-foreground">{ind.display_name}</span>
                    <Badge variant="outline" className="text-[10px]">{ind.key}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Geography Gates */}
        <Card>
          <CardHeader>
            <CardTitle>Geography Selection Gates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>MA Slots</Label><Input type="number" defaultValue={45} disabled /><p className="text-xs text-muted-foreground mt-1">Top 45</p></div>
              <div><Label>NE Slots</Label><Input type="number" defaultValue={4} disabled /><p className="text-xs text-muted-foreground mt-1">★★★ only</p></div>
              <div><Label>National</Label><Input type="number" defaultValue={1} disabled /><p className="text-xs text-muted-foreground mt-1">★★★ only</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Signals & Scanners */}
        <Separator />
        <div>
          <h2 className="text-xl font-bold text-foreground">Signals & Scanners</h2>
          <p className="text-sm text-muted-foreground mb-4">Keyword lists used by the daily discovery pipeline to detect carrier changes and HR/benefits news.</p>
        </div>
        <KeywordListEditor category="carrier_names" />
        <KeywordListEditor category="carrier_change_phrases" />
        <KeywordListEditor category="benefits_hr_keywords" />
      </div>
    </Layout>
  );
}
