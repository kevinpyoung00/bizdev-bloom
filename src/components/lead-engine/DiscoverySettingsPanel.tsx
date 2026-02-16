import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DiscoveryToggles {
  allow_edu: boolean;
  allow_gov: boolean;
  allow_hospital_systems: boolean;
  allow_university_research: boolean;
}

interface IcpBand {
  min_employees: number;
  max_employees: number;
}

export default function DiscoverySettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [blacklistDomains, setBlacklistDomains] = useState('');
  const [blacklistNames, setBlacklistNames] = useState('');
  const [toggles, setToggles] = useState<DiscoveryToggles>({
    allow_edu: true, allow_gov: false, allow_hospital_systems: false, allow_university_research: false,
  });
  const [icpBand, setIcpBand] = useState<IcpBand>({ min_employees: 20, max_employees: 500 });
  const [sweepSize, setSweepSize] = useState(300);
  const [cronEnabled, setCronEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('discovery_settings').select('key, value');
      for (const row of data || []) {
        const r = row as any;
        switch (r.key) {
          case 'blacklist_domains': setBlacklistDomains((r.value as string[]).join('\n')); break;
          case 'blacklist_names': setBlacklistNames((r.value as string[]).join('\n')); break;
          case 'toggles': setToggles(r.value as DiscoveryToggles); break;
          case 'icp_band': setIcpBand(r.value as IcpBand); break;
          case 'sweep_size': setSweepSize(typeof r.value === 'number' ? r.value : parseInt(String(r.value)) || 300); break;
          case 'cron_enabled': setCronEnabled(r.value === true || r.value === 'true'); break;
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'blacklist_domains', value: blacklistDomains.split('\n').map(s => s.trim()).filter(Boolean) },
        { key: 'blacklist_names', value: blacklistNames.split('\n').map(s => s.trim()).filter(Boolean) },
        { key: 'toggles', value: toggles },
        { key: 'icp_band', value: icpBand },
        { key: 'sweep_size', value: sweepSize },
        { key: 'cron_enabled', value: cronEnabled },
      ];
      for (const u of updates) {
        await supabase.from('discovery_settings').upsert(
          { key: u.key, value: u.value as any },
          { onConflict: 'key' }
        );
      }
      toast.success('Discovery settings saved');
    } catch (e: any) {
      toast.error('Failed to save', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 p-4"><Loader2 size={16} className="animate-spin" /> Loading settings…</div>;

  const sweepOptions = [75, 150, 300, 600];

  return (
    <div className="space-y-6">
      {/* Blacklist */}
      <Card>
        <CardHeader>
          <CardTitle>ICP Blacklist</CardTitle>
          <CardDescription>Domains and company names to always exclude (carriers, hospital systems, research institutes). One per line.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">Blacklisted Domains</Label>
            <Textarea
              value={blacklistDomains}
              onChange={(e) => setBlacklistDomains(e.target.value)}
              placeholder="bcbs.com&#10;massgeneral.org&#10;..."
              className="mt-1 font-mono text-xs"
              rows={6}
            />
          </div>
          <div>
            <Label className="text-sm font-semibold">Blacklisted Company Names</Label>
            <Textarea
              value={blacklistNames}
              onChange={(e) => setBlacklistNames(e.target.value)}
              placeholder="Blue Cross Blue Shield&#10;Mass General Brigham&#10;..."
              className="mt-1 font-mono text-xs"
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Classification Toggles</CardTitle>
          <CardDescription>Control which entity types pass ICP classification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'allow_edu' as const, label: 'Allow .edu domains (schools, colleges)' },
            { key: 'allow_gov' as const, label: 'Allow .gov domains (municipalities)' },
            { key: 'allow_hospital_systems' as const, label: 'Allow hospital systems' },
            { key: 'allow_university_research' as const, label: 'Allow university research labs/centers' },
          ].map(t => (
            <div key={t.key} className="flex items-center gap-3">
              <Switch
                checked={toggles[t.key]}
                onCheckedChange={(v) => setToggles(prev => ({ ...prev, [t.key]: v }))}
                id={`toggle-${t.key}`}
              />
              <Label htmlFor={`toggle-${t.key}`} className="text-sm cursor-pointer">{t.label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ICP Band */}
      <Card>
        <CardHeader>
          <CardTitle>ICP Employee Band</CardTitle>
          <CardDescription>Preferred employee count range for employer classification.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-xs">Min</Label>
              <Input type="number" value={icpBand.min_employees} onChange={(e) => setIcpBand(p => ({ ...p, min_employees: parseInt(e.target.value) || 0 }))} className="w-24 mt-1" />
            </div>
            <span className="text-muted-foreground mt-5">–</span>
            <div>
              <Label className="text-xs">Max</Label>
              <Input type="number" value={icpBand.max_employees} onChange={(e) => setIcpBand(p => ({ ...p, max_employees: parseInt(e.target.value) || 500 }))} className="w-24 mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sweep Size */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Sweep Size</CardTitle>
          <CardDescription>Number of net-new candidates to process per auto-discovery run.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {sweepOptions.map(n => (
              <Badge
                key={n}
                variant={sweepSize === n ? 'default' : 'outline'}
                className="cursor-pointer text-xs px-3 py-1"
                onClick={() => setSweepSize(n)}
              >
                {n}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cron Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>8:00 AM Daily Cron</CardTitle>
          <CardDescription>Enable/disable the automatic daily discovery job.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={cronEnabled} onCheckedChange={setCronEnabled} id="cron-toggle" />
            <Label htmlFor="cron-toggle" className="text-sm cursor-pointer">
              {cronEnabled ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save Discovery Settings
      </Button>
    </div>
  );
}
