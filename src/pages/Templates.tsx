import { useState } from 'react';
import Layout from '@/components/crm/Layout';
import { emailTemplates, linkedInTemplates } from '@/data/templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Star, Search, Mail, Linkedin, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function Templates() {
  const [emailSearch, setEmailSearch] = useState('');
  const [liSearch, setLiSearch] = useState('');
  const [starredEmails, setStarredEmails] = useState<Set<string>>(new Set());
  const [starredLi, setStarredLi] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [weekFilter, setWeekFilter] = useState<number | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleStarEmail = (id: string) => {
    setStarredEmails(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStarLi = (id: string) => {
    setStarredLi(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredEmails = emailTemplates.filter(t => {
    if (weekFilter !== null && t.week !== weekFilter) return false;
    if (emailSearch) {
      const q = emailSearch.toLowerCase();
      return t.subject.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredLi = linkedInTemplates.filter(t => {
    if (liSearch) {
      const q = liSearch.toLowerCase();
      return t.type.toLowerCase().includes(q) || t.message.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <Layout>
      <div className="p-6 space-y-4 animate-slide-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Template Library</h1>
          <p className="text-sm text-muted-foreground">Email and LinkedIn templates with merge tags. Copy, personalize, and send.</p>
        </div>

        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email" className="flex items-center gap-1"><Mail size={14} /> Email Templates</TabsTrigger>
            <TabsTrigger value="linkedin" className="flex items-center gap-1"><Linkedin size={14} /> LinkedIn Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search email templates..." value={emailSearch} onChange={e => setEmailSearch(e.target.value)} />
              </div>
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant={weekFilter === null ? 'default' : 'outline'} onClick={() => setWeekFilter(null)} className="text-xs h-8">All</Button>
                {Array.from({ length: 12 }, (_, i) => (
                  <Button key={i} size="sm" variant={weekFilter === i + 1 ? 'default' : 'outline'} onClick={() => setWeekFilter(i + 1)} className="text-xs h-8 w-8 p-0">
                    {i + 1}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredEmails.map(t => (
                <div key={t.id} className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">Week {t.week}</span>
                      <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{t.campaignType}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleStarEmail(t.id)}>
                        <Star size={14} className={starredEmails.has(t.id) ? 'fill-warning text-warning' : 'text-muted-foreground'} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard(`Subject: ${t.subject}\n\n${t.body}`, t.id)}>
                        {copiedId === t.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>
                  <p className="font-medium text-sm text-card-foreground mb-1">Subject: {t.subject}</p>
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{t.body}</pre>
                  <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded p-2">💡 {t.personalizationTip}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="linkedin" className="space-y-4 mt-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search LinkedIn templates..." value={liSearch} onChange={e => setLiSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredLi.map(t => (
                <div key={t.id} className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="bg-info/10 text-info text-xs font-medium px-2 py-0.5 rounded-full">{t.type}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleStarLi(t.id)}>
                        <Star size={14} className={starredLi.has(t.id) ? 'fill-warning text-warning' : 'text-muted-foreground'} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard(t.message, t.id)}>
                        {copiedId === t.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{t.message}</p>
                  <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded p-2">💡 {t.personalizationTip}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
