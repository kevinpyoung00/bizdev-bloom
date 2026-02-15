import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { useCrm } from '@/store/CrmContext';
import { RolePersona, ContactSource, ContactStatus, createEmptySignals } from '@/types/crm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const CONTACT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'company', label: 'Company', required: true },
  { key: 'title', label: 'Title' },
  { key: 'rolePersona', label: 'Role Persona' },
  { key: 'industry', label: 'Industry' },
  { key: 'employeeCount', label: 'Employee Count' },
  { key: 'email', label: 'Email' },
  { key: 'linkedInUrl', label: 'LinkedIn URL' },
  { key: 'phone', label: 'Phone' },
  { key: 'source', label: 'Source' },
  { key: 'renewalMonth', label: 'Renewal Month' },
  { key: 'notes', label: 'Notes' },
];

const ROLE_MAP: Record<string, RolePersona> = {
  'ceo': 'CEO', 'founder': 'Founder', 'cfo': 'CFO', 'coo': 'COO',
  'chro': 'CHRO', 'hr': 'HR', 'benefits': 'Benefits Leader',
  'finance': 'Finance', 'ops': 'Ops', 'other': 'Other',
};

const SOURCE_MAP: Record<string, ContactSource> = {
  'sales navigator': 'Sales Navigator', 'zoominfo': 'ZoomInfo',
  'zywave': 'Zywave', 'list upload': 'List Upload',
};

function guessMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const patterns: Record<string, RegExp> = {
    name: /^name$|full.?name|contact.?name|first.?name|fname/i,
    company: /company|organization|org/i,
    title: /title|job.?title|position/i,
    rolePersona: /role|persona/i,
    industry: /industry|sector|vertical/i,
    employeeCount: /employee|emp.?count|size|headcount|# of emp/i,
    email: /email|e-?mail/i,
    linkedInUrl: /linkedin|li.?url|li.?profile/i,
    phone: /phone|mobile|cell|tel/i,
    source: /source|lead.?source|origin/i,
    renewalMonth: /renewal|renew/i,
    notes: /notes?|comment/i,
  };
  for (const [field, regex] of Object.entries(patterns)) {
    const match = headers.find(h => regex.test(h));
    if (match) map[field] = match;
  }
  return map;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeRole(val: string): RolePersona {
  const lower = val.toLowerCase().trim();
  for (const [key, role] of Object.entries(ROLE_MAP)) {
    if (lower.includes(key)) return role;
  }
  return 'Other';
}

function normalizeSource(val: string): ContactSource {
  const lower = val.toLowerCase().trim();
  for (const [key, source] of Object.entries(SOURCE_MAP)) {
    if (lower.includes(key)) return source;
  }
  return 'List Upload';
}

const importContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  company: z.string().trim().max(200).default(''),
  title: z.string().trim().max(100).default(''),
  rolePersona: z.string().trim().max(50).default(''),
  industry: z.string().trim().max(100).default(''),
  employeeCount: z.string().trim().max(20).default(''),
  email: z.string().trim().max(255).refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email').default(''),
  linkedInUrl: z.string().trim().max(500).refine(v => !v || /^https?:\/\//i.test(v), 'Invalid URL').default(''),
  phone: z.string().trim().max(30).default(''),
  source: z.string().trim().max(50).default(''),
  renewalMonth: z.string().trim().max(20).default(''),
  notes: z.string().trim().max(2000).default(''),
});

type Step = 'upload' | 'map' | 'preview' | 'done';
type TitleMode = 'filename' | 'custom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportContacts({ open, onOpenChange }: Props) {
  const { addContact, campaigns } = useCrm();
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [campaignId, setCampaignId] = useState('');
  const [status, setStatus] = useState<ContactStatus>('Unworked');
  const [importCount, setImportCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [listTitle, setListTitle] = useState('');
  const [titleMode, setTitleMode] = useState<TitleMode>('filename');
  const [customTitle, setCustomTitle] = useState('');

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setCampaignId('');
    setStatus('Unworked');
    setImportCount(0);
    setFileName('');
    setListTitle('');
    setTitleMode('filename');
    setCustomTitle('');
  };

  const getFileBaseName = (name: string) => name.replace(/\.(xlsx|xls|csv)$/i, '');

  const effectiveTitle = titleMode === 'custom' ? customTitle : getFileBaseName(fileName);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setListTitle(file.name.replace(/\.(xlsx|xls|csv)$/i, ''));
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (json.length === 0) {
          toast.error('Spreadsheet is empty');
          return;
        }
        const hdrs = Object.keys(json[0]);
        const stringRows = json.map(row => {
          const r: Record<string, string> = {};
          for (const h of hdrs) r[h] = String(row[h] ?? '');
          return r;
        });
        setHeaders(hdrs);
        setRows(stringRows);
        setMapping(guessMapping(hdrs));
        setStep('map');
      } catch {
        toast.error('Could not parse file. Please upload a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const mappedPreview = rows.slice(0, 5).map(row => {
    const contact: Record<string, string> = {};
    for (const field of CONTACT_FIELDS) {
      const col = mapping[field.key];
      contact[field.key] = col ? (row[col] || '') : '';
    }
    return contact;
  });

  const requiredMissing = CONTACT_FIELDS
    .filter(f => f.required && !mapping[f.key])
    .map(f => f.label);

  const handleImport = () => {
    const today = new Date().toISOString().split('T')[0];
    let count = 0;
    let skipped = 0;
    for (const row of rows) {
      const raw: Record<string, string> = {};
      for (const field of CONTACT_FIELDS) {
        const col = mapping[field.key];
        raw[field.key] = col ? (row[col] || '') : '';
      }

      const parsed = importContactSchema.safeParse(raw);
      if (!parsed.success) {
        skipped++;
        continue;
      }
      const v = parsed.data;

      const { firstName, lastName } = splitName(v.name);

      const noteParts: string[] = [];
      if (v.notes) noteParts.push(v.notes);

      addContact({
        firstName,
        lastName,
        company: v.company,
        title: v.title,
        rolePersona: v.rolePersona ? normalizeRole(v.rolePersona) : 'Other',
        industry: v.industry,
        employeeCount: v.employeeCount,
        email: v.email,
        linkedInUrl: v.linkedInUrl,
        phone: v.phone,
        source: v.source ? normalizeSource(v.source) : 'List Upload',
        renewalMonth: v.renewalMonth,
        campaignId,
        status,
        startDate: today,
        notes: noteParts.join('\n'),
        signals: createEmptySignals(),
      });
      count++;
    }
    setImportCount(count);
    setStep('done');
    if (skipped > 0) {
      toast.success(`${count} contacts imported, ${skipped} rows skipped (invalid data)`);
    } else {
      toast.success(`${count} contacts imported successfully!`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" />
            Import Contacts from Spreadsheet
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full font-medium ${step === s ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {i + 1}
              </span>
              <span className={step === s ? 'text-foreground font-medium' : ''}>
                {s === 'upload' ? 'Upload' : s === 'map' ? 'Map Columns' : s === 'preview' ? 'Review' : 'Done'}
              </span>
              {i < 3 && <ArrowRight size={12} />}
            </div>
          ))}
        </div>

        {/* UPLOAD */}
        {step === 'upload' && (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.xlsx,.xls,.csv';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            <Upload size={40} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-foreground font-medium mb-1">Drop your spreadsheet here or click to browse</p>
            <p className="text-sm text-muted-foreground">Supports .xlsx, .xls, and .csv files</p>
          </div>
        )}

        {/* MAP COLUMNS */}
        {step === 'map' && (
          <div className="space-y-4">
            {/* List Title */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
              <Label className="text-sm font-medium">List Title</Label>
              <RadioGroup value={titleMode} onValueChange={v => setTitleMode(v as TitleMode)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="filename" id="title-filename" />
                  <Label htmlFor="title-filename" className="text-xs font-normal cursor-pointer">
                    Use file name: <span className="font-medium text-foreground">{getFileBaseName(fileName)}</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="custom" id="title-custom" />
                  <Label htmlFor="title-custom" className="text-xs font-normal cursor-pointer">Custom title</Label>
                </div>
              </RadioGroup>
              {titleMode === 'custom' && (
                <Input
                  className="h-8 text-sm"
                  placeholder="e.g. Q2 Florida Tech Prospects"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> — {rows.length} rows found. Map your columns below.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {CONTACT_FIELDS.map(field => (
                <div key={field.key}>
                  <Label className="text-xs">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mapping[field.key] || '__skip__'}
                    onValueChange={v => setMapping(prev => ({ ...prev, [field.key]: v === '__skip__' ? '' : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">— Skip —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div>
                <Label className="text-xs">Assign Campaign</Label>
                <Select value={campaignId || '__none__'} onValueChange={v => setCampaignId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {campaigns.filter(c => c.active).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Initial Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as ContactStatus)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['Unworked', 'In Sequence'] as ContactStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {requiredMissing.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle size={14} />
                Missing required: {requiredMissing.join(', ')}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Back</Button>
              <Button size="sm" disabled={requiredMissing.length > 0} onClick={() => setStep('preview')}>
                Preview Import <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Previewing first {Math.min(5, rows.length)} of <span className="font-medium text-foreground">{rows.length}</span> contacts.
              </p>
              {effectiveTitle && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                  {effectiveTitle}
                </span>
              )}
            </div>
            <div className="overflow-x-auto border border-border rounded">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    {CONTACT_FIELDS.filter(f => mapping[f.key]).map(f => (
                      <th key={f.key} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      {CONTACT_FIELDS.filter(f => mapping[f.key]).map(f => (
                        <td key={f.key} className="px-3 py-2 text-foreground whitespace-nowrap max-w-[200px] truncate">{row[f.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('map')}>Back</Button>
              <Button size="sm" onClick={handleImport}>
                Import {rows.length} Contacts
              </Button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 size={48} className="mx-auto text-primary" />
            <p className="text-lg font-semibold text-foreground">{importCount} contacts imported!</p>
            {effectiveTitle && (
              <p className="text-sm text-muted-foreground">
                List: <span className="font-medium text-foreground">{effectiveTitle}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              They're ready to use in your drip campaigns.
            </p>
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
