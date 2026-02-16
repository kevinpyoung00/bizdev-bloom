import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Radar, Play } from 'lucide-react';
import {
  PANEL_INDUSTRIES,
  PANEL_TRIGGERS,
  US_STATES,
  GEO_SHORTCUTS,
  COMPANY_SIZES,
  DISCOVERY_TYPES,
  RESULT_COUNTS,
} from '@/data/discoveryThemes';

export interface DiscoveryPanelParams {
  industries: string[];
  triggers: string[];
  geography: string[];
  company_size: string;
  discovery_type: string;
  result_count: number;
  override_ma_ne: boolean;
  score_after: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (params: DiscoveryPanelParams) => void;
  isRunning: boolean;
}

export default function DiscoveryControlPanel({ open, onOpenChange, onRun, isRunning }: Props) {
  const [industries, setIndustries] = useState<Set<string>>(new Set(['biotech_life_sciences']));
  const [triggers, setTriggers] = useState<Set<string>>(new Set(['funding']));
  const [geoStates, setGeoStates] = useState<Set<string>>(new Set(['MA']));
  const [companySize, setCompanySize] = useState('50-149');
  const [discoveryType, setDiscoveryType] = useState('full');
  const [resultCount, setResultCount] = useState(50);
  const [overrideMaNe, setOverrideMaNe] = useState(false);
  const [scoreAfter, setScoreAfter] = useState(false);

  const toggleIndustry = (key: string) => {
    setIndustries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleTrigger = (key: string) => {
    setTriggers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleState = (st: string) => {
    setGeoStates(prev => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      return next;
    });
  };

  const applyShortcut = (states: string[]) => {
    setGeoStates(new Set(states));
  };

  const handleRun = () => {
    onRun({
      industries: Array.from(industries),
      triggers: Array.from(triggers),
      geography: Array.from(geoStates),
      company_size: companySize,
      discovery_type: discoveryType,
      result_count: resultCount,
      override_ma_ne: overrideMaNe,
      score_after: scoreAfter,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Radar size={20} /> Discovery Control Panel
          </SheetTitle>
          <SheetDescription>
            Configure and run on-demand discovery. Select industries, triggers, geography, and more.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 pb-4">
            {/* B.1 Industries */}
            <div>
              <Label className="text-sm font-semibold">Industries</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PANEL_INDUSTRIES.map(ind => (
                  <Badge
                    key={ind.key}
                    variant={industries.has(ind.key) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs px-3 py-1"
                    onClick={() => toggleIndustry(ind.key)}
                  >
                    {ind.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* B.2 Trigger Types */}
            <div>
              <Label className="text-sm font-semibold">Trigger Types</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PANEL_TRIGGERS.map(tr => (
                  <Badge
                    key={tr.key}
                    variant={triggers.has(tr.key) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs px-3 py-1"
                    onClick={() => toggleTrigger(tr.key)}
                  >
                    {tr.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* B.3 Geography */}
            <div>
              <Label className="text-sm font-semibold">Geography</Label>
              <div className="flex gap-2 mt-2 mb-3">
                {GEO_SHORTCUTS.map(sc => (
                  <Button
                    key={sc.key}
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-7"
                    onClick={() => applyShortcut(sc.states)}
                  >
                    {sc.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {US_STATES.map(st => (
                  <Badge
                    key={st}
                    variant={geoStates.has(st) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] px-2 py-0.5 font-mono"
                    onClick={() => toggleState(st)}
                  >
                    {st}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Selected: {geoStates.size} state{geoStates.size !== 1 ? 's' : ''}
              </p>
            </div>

            <Separator />

            {/* Override toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={overrideMaNe} onCheckedChange={setOverrideMaNe} id="override-mane" />
              <Label htmlFor="override-mane" className="text-xs cursor-pointer">
                Override MA/NE-only filter (allow any US state in results)
              </Label>
            </div>

            <Separator />

            {/* B.4 Company Size */}
            <div>
              <Label className="text-sm font-semibold">Company Size</Label>
              <div className="flex gap-2 mt-2">
                {COMPANY_SIZES.map(cs => (
                  <Badge
                    key={cs.key}
                    variant={companySize === cs.key ? 'default' : 'outline'}
                    className="cursor-pointer text-xs px-3 py-1"
                    onClick={() => setCompanySize(cs.key)}
                  >
                    {cs.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* B.5 Discovery Type */}
            <div>
              <Label className="text-sm font-semibold">Discovery Type</Label>
              <Select value={discoveryType} onValueChange={setDiscoveryType}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOVERY_TYPES.map(dt => (
                    <SelectItem key={dt.key} value={dt.key}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* B.6 Result Count */}
            <div>
              <Label className="text-sm font-semibold">Result Count</Label>
              <div className="flex gap-2 mt-2">
                {RESULT_COUNTS.map(n => (
                  <Badge
                    key={n}
                    variant={resultCount === n ? 'default' : 'outline'}
                    className="cursor-pointer text-xs px-3 py-1"
                    onClick={() => setResultCount(n)}
                  >
                    {n}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Score after discovery */}
            <div className="flex items-center gap-3">
              <Checkbox
                checked={scoreAfter}
                onCheckedChange={(v) => setScoreAfter(!!v)}
                id="score-after"
              />
              <Label htmlFor="score-after" className="text-xs cursor-pointer">
                Run Scoring after discovery completes
              </Label>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="pt-4 border-t">
          <Button onClick={handleRun} disabled={isRunning || industries.size === 0} className="w-full gap-2">
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isRunning ? 'Running Discovery…' : 'Run Discovery Now'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
