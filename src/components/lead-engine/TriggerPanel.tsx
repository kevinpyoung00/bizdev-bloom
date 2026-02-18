import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Tag } from 'lucide-react';
import type { TriggerTag } from '@/types/bizdev';

const DEFAULT_TRIGGERS = [
  'New leadership',
  'Hiring surge',
  'Recent funding',
  'Expansion',
  'Renewal window',
  'Competitor movement',
];

interface TriggerPanelProps {
  onSave: (tags: TriggerTag[]) => void;
  initialTags?: TriggerTag[];
}

export default function TriggerPanel({ onSave, initialTags = [] }: TriggerPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialTags.map(t => t.label))
  );
  const [custom, setCustom] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);

  const toggle = (label: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const addCustom = () => {
    const trimmed = custom.trim();
    if (!trimmed || selected.has(trimmed) || customTags.includes(trimmed)) return;
    setCustomTags(prev => [...prev, trimmed]);
    setSelected(prev => new Set([...prev, trimmed]));
    setCustom('');
  };

  const handleSave = () => {
    const tags: TriggerTag[] = Array.from(selected).map(label => ({
      label,
      source: 'manual' as const,
      category: DEFAULT_TRIGGERS.includes(label) ? 'standard' : 'custom',
    }));
    onSave(tags);
  };

  const allLabels = [...DEFAULT_TRIGGERS, ...customTags.filter(c => !DEFAULT_TRIGGERS.includes(c))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Tag size={16} className="text-primary" />
        <span className="text-sm font-medium text-foreground">Tag Manual Triggers</span>
        <Badge variant="outline" className="text-[10px]">{selected.size} selected</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Select the Sales Navigator / Apollo filters you used for this batch. These become manual triggers on every contact.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {allLabels.map(label => (
          <label
            key={label}
            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
          >
            <Checkbox
              checked={selected.has(label)}
              onCheckedChange={() => toggle(label)}
            />
            <span className="text-foreground">{label}</span>
            {!DEFAULT_TRIGGERS.includes(label) && (
              <Badge variant="secondary" className="text-[9px] ml-auto">custom</Badge>
            )}
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          placeholder="Add custom trigger…"
          className="text-sm"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
        />
        <Button size="sm" variant="outline" onClick={addCustom} disabled={!custom.trim()}>
          <Plus size={14} />
        </Button>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave}>
          Save Triggers
        </Button>
      </div>
    </div>
  );
}
