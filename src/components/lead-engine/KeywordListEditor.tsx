import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, X, GripVertical, Save, Loader2 } from 'lucide-react';
import { useSignalKeywords, useUpdateKeywords, type KeywordCategory, CATEGORY_LABELS } from '@/hooks/useSignalKeywords';

const CATEGORY_DESCRIPTIONS: Record<KeywordCategory, string> = {
  carrier_names: 'Health insurance carrier names to detect in news and career pages',
  carrier_change_phrases: 'Phrases that indicate a company is switching carriers',
  benefits_hr_keywords: 'Benefits, HR, and MA compliance terms for news scanning',
};

export default function KeywordListEditor({ category }: { category: KeywordCategory }) {
  const { data, isLoading } = useSignalKeywords(category);
  const updateMutation = useUpdateKeywords();
  const [localKeywords, setLocalKeywords] = useState<string[] | null>(null);
  const [newTerm, setNewTerm] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const keywords = localKeywords ?? data?.keywords ?? [];
  const isDirty = localKeywords !== null;

  const setKeywords = (kw: string[]) => setLocalKeywords(kw);

  const addTerm = () => {
    const term = newTerm.trim();
    if (!term || keywords.includes(term)) return;
    setKeywords([...keywords, term]);
    setNewTerm('');
  };

  const removeTerm = (idx: number) => {
    setKeywords(keywords.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    updateMutation.mutate({ category, keywords }, {
      onSuccess: () => setLocalKeywords(null),
    });
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...keywords];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setKeywords(reordered);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{CATEGORY_LABELS[category]}</CardTitle>
            <CardDescription className="text-xs mt-1">{CATEGORY_DESCRIPTIONS[category]}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{keywords.length} terms</Badge>
            {isDirty && (
              <Button size="sm" variant="default" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="Add keyword or phrase…"
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTerm())}
              />
              <Button size="sm" variant="outline" onClick={addTerm} disabled={!newTerm.trim()}>
                <Plus size={14} />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {keywords.map((kw, idx) => (
                <div
                  key={`${kw}-${idx}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-1 border border-border rounded-md px-2 py-1 text-xs cursor-grab transition-colors ${
                    dragIdx === idx ? 'bg-accent' : 'bg-background hover:bg-muted'
                  }`}
                >
                  <GripVertical size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                  <span className="text-foreground">{kw}</span>
                  <button onClick={() => removeTerm(idx)} className="text-muted-foreground hover:text-destructive ml-0.5">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
