import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, CheckCircle2, ArrowRight, Loader2, Plus, Trash2, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { canonicalCompanyName, fuzzyMatch } from '@/lib/canonicalize';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import TriggerPanel from '@/components/lead-engine/TriggerPanel';
import type { TriggerTag } from '@/types/bizdev';
import { resolvePhone, resolveIndustry, normalizeUrl, type PhoneResult, type IndustryResult } from '@/lib/importNormalizers';

interface ParsedFile {
  name: string;
  source: string;
  rows: Record<string, string>[];
  headers: string[];
}

interface MergedContact {
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  phone_is_company: boolean;
  phones_raw: Record<string, string>;
  linkedin_url: string;
  company_name: string;
  company_domain: string;
  industry: string;
  industry_raw: Record<string, string>;
  employee_count: string;
  hq_city: string;
  hq_state: string;
  invalid_urls: Record<string, string>;
  _sources: string[];
  _fields_merged: Record<string, string>;
}

const SOURCE_DETECT: Record<string, RegExp> = {
  SalesNavigator: /sales.?nav/i,
  Apollo: /apollo/i,
  ZoomInfo: /zoom.?info/i,
  Zywave: /zywave/i,
};

function detectSource(filename: string): string {
  for (const [src, re] of Object.entries(SOURCE_DETECT)) {
    if (re.test(filename)) return src;
  }
  return 'Other';
}

const HEADER_MAP: Record<string, RegExp> = {
  first_name: /first.?name|fname|^first$/i,
  last_name: /last.?name|lname|surname|^last$/i,
  title: /title|job.?title|position|^role$/i,
  email: /email|e-?mail/i,
  phone: /phone|mobile|direct.?phone|work.?phone|direct.?dial|business.?phone|corporate.?phone|company.?phone/i,
  linkedin_url: /linkedin|li.?url|li.?profile|person.?linkedin|contact.?linkedin|profile.?url/i,
  company_name: /company|org|account|company.?name/i,
  company_domain: /\b(domain|website|company.?url|web|company.?website)\b/i,
  industry: /industry|sector|primary.?industry|all.?industr|industry.?hierarchical/i,
  employee_count: /employee|emp.?count|size|headcount|number.?of.?emp/i,
  hq_city: /city|hq.?city/i,
  hq_state: /state|hq.?state|region/i,
};

const FIELD_LABELS: Record<string, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  title: 'Job Title',
  email: 'Email',
  phone: 'Phone',
  linkedin_url: 'LinkedIn URL',
  company_name: 'Company Name',
  company_domain: 'Company Domain',
  industry: 'Industry',
  employee_count: 'Employee Count',
  hq_city: 'HQ City',
  hq_state: 'HQ State',
};

const REQUIRED_FIELDS = ['first_name', 'last_name', 'company_name'];

const LINKEDIN_URL_RE = /linkedin\.com/i;

function autoMapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [field, re] of Object.entries(HEADER_MAP)) {
    const h = headers.find(h => re.test(h));
    if (h) map[field] = h;
  }
  return map;
}

// Field priority: source-based
const EMAIL_PRIORITY = ['Apollo', 'ZoomInfo', 'Other', 'SalesNavigator', 'Zywave'];
const PHONE_PRIORITY = ['ZoomInfo', 'Apollo', 'Other', 'SalesNavigator', 'Zywave'];
const TITLE_PRIORITY = ['SalesNavigator', 'Apollo', 'ZoomInfo', 'Other', 'Zywave'];
const DOMAIN_PRIORITY = ['ZoomInfo', 'Other', 'Apollo', 'SalesNavigator', 'Zywave'];

function pickBestField(entries: { value: string; source: string }[], priority: string[]): { value: string; source: string } | null {
  const nonEmpty = entries.filter(e => e.value.trim());
  if (nonEmpty.length === 0) return null;
  nonEmpty.sort((a, b) => priority.indexOf(a.source) - priority.indexOf(b.source));
  return nonEmpty[0];
}

type Step = 'upload' | 'mapping' | 'triggers' | 'preview' | 'importing' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MultiSourceImporter({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const triggersEnabled = useFeatureFlag('bizdev_triggers');
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [merged, setMerged] = useState<MergedContact[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [importResult, setImportResult] = useState<{ accounts: number; contacts: number; merged: number } | null>(null);
  // Per-file manual header mappings: fileIndex -> { field -> csvHeader }
  const [fileMappings, setFileMappings] = useState<Record<number, Record<string, string>>>({});
  // Batch trigger tags (manual triggers applied to entire import batch)
  const [batchTriggers, setBatchTriggers] = useState<TriggerTag[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  const reset = () => {
    setFiles([]);
    setMerged([]);
    setStep('upload');
    setImportResult(null);
    setFileMappings({});
    setBatchTriggers([]);
    setBatchId(null);
  };

  const addFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (json.length === 0) { toast.error('File is empty'); return; }

        const headers = Object.keys(json[0]);
        const rows = json.map(r => {
          const row: Record<string, string> = {};
          for (const h of headers) row[h] = String(r[h] ?? '');
          return row;
        });

        const source = detectSource(file.name);
        setFiles(prev => {
          const newFiles = [...prev, { name: file.name, source, rows, headers }];
          // Auto-map headers for this new file
          const idx = newFiles.length - 1;
          const autoMap = autoMapHeaders(headers);
          setFileMappings(prev => ({ ...prev, [idx]: autoMap }));
          return newFiles;
        });
        toast.success(`Added ${file.name} (${rows.length} rows, source: ${source})`);
      } catch {
        toast.error('Could not parse file');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleShowMapping = () => {
    // Initialize mappings for any files that don't have them yet
    const newMappings = { ...fileMappings };
    files.forEach((f, i) => {
      if (!newMappings[i]) {
        newMappings[i] = autoMapHeaders(f.headers);
      }
    });
    setFileMappings(newMappings);
    setStep('mapping');
  };

  const updateFieldMapping = (fileIndex: number, field: string, csvHeader: string) => {
    setFileMappings(prev => ({
      ...prev,
      [fileIndex]: {
        ...prev[fileIndex],
        [field]: csvHeader === '__none__' ? '' : csvHeader,
      },
    }));
  };

  const handleMerge = () => {
    const allRows: { row: Record<string, string>; source: string; mapping: Record<string, string> }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const mapping = fileMappings[i] || autoMapHeaders(f.headers);
      // Filter out empty mappings
      const cleanMapping: Record<string, string> = {};
      for (const [k, v] of Object.entries(mapping)) {
        if (v) cleanMapping[k] = v;
      }
      for (const row of f.rows) {
        allRows.push({ row, source: f.source, mapping: cleanMapping });
      }
    }

    // Group by merge key: email > linkedin > (company_domain + canonical)
    const byKey = new Map<string, { entries: typeof allRows }>();

    for (const item of allRows) {
      const m = item.mapping;
      const email = (m.email ? item.row[m.email] : '').trim().toLowerCase();
      const linkedin = (m.linkedin_url ? item.row[m.linkedin_url] : '').trim().toLowerCase();
      const companyName = (m.company_name ? item.row[m.company_name] : '').trim();
      const domain = (m.company_domain ? item.row[m.company_domain] : '').trim().toLowerCase();
      const canonical = canonicalCompanyName(companyName);

      let key = '';
      if (email) key = `email:${email}`;
      else if (linkedin) key = `li:${linkedin}`;
      else if (domain) key = `domain:${domain}|${canonical}`;
      else if (canonical) key = `canonical:${canonical}`;
      else key = `row:${Math.random()}`;

      if (!byKey.has(key)) byKey.set(key, { entries: [] });
      byKey.get(key)!.entries.push(item);
    }

    // Merge each group
    const results: MergedContact[] = [];
    for (const [, group] of byKey) {
      const fields_merged: Record<string, string> = {};
      const sources = [...new Set(group.entries.map(e => e.source))];

      const getField = (field: string) => group.entries.map(e => ({
        value: (e.mapping[field] ? e.row[e.mapping[field]] : '').trim(),
        source: e.source,
      }));

      const emailPick = pickBestField(getField('email'), EMAIL_PRIORITY);
      const titlePick = pickBestField(getField('title'), TITLE_PRIORITY);
      const domainPick = pickBestField(getField('company_domain'), DOMAIN_PRIORITY);
      const linkedinPick = getField('linkedin_url').find(e => e.value);

      if (emailPick) fields_merged.email = emailPick.source;
      if (titlePick) fields_merged.title = titlePick.source;
      if (domainPick) fields_merged.company_domain = domainPick.source;

      const firstNonEmpty = (field: string) => {
        for (const e of group.entries) {
          const v = (e.mapping[field] ? e.row[e.mapping[field]] : '').trim();
          if (v) return v;
        }
        return '';
      };

      // ── Phone: ordered header priority across all raw rows ──
      let phoneResult: PhoneResult = { phone_direct: '', phone_is_company: false, phones_raw: {} };
      for (const entry of group.entries) {
        const pr = resolvePhone(entry.row, entry.row ? Object.keys(entry.row) : []);
        // Merge raw debug values
        for (const [k, v] of Object.entries(pr.phones_raw)) {
          phoneResult.phones_raw[`${entry.source}:${k}`] = v;
        }
        if (!phoneResult.phone_direct && pr.phone_direct) {
          phoneResult = { ...pr, phones_raw: phoneResult.phones_raw };
        }
      }
      // Fallback to old mapped phone if resolvePhone found nothing
      const oldPhonePick = pickBestField(getField('phone'), PHONE_PRIORITY);
      if (!phoneResult.phone_direct && oldPhonePick?.value) {
        phoneResult.phone_direct = oldPhonePick.value;
      }
      if (phoneResult.phone_direct) fields_merged.phone = 'priority_resolved';

      // ── Industry: ordered header priority across all raw rows ──
      let industryResult: IndustryResult = { industry: '', industry_raw: {} };
      for (const entry of group.entries) {
        const ir = resolveIndustry(entry.row, Object.keys(entry.row));
        for (const [k, v] of Object.entries(ir.industry_raw)) {
          industryResult.industry_raw[`${entry.source}:${k}`] = v;
        }
        if (!industryResult.industry && ir.industry) {
          industryResult = { ...ir, industry_raw: industryResult.industry_raw };
        }
      }
      // Fallback to old first-non-empty
      if (!industryResult.industry) {
        industryResult.industry = firstNonEmpty('industry');
      }

      // Sanitize: if company_domain looks like a LinkedIn URL, move it to linkedin_url
      let finalDomain = domainPick?.value || '';
      let finalLinkedin = linkedinPick?.value || '';
      if (LINKEDIN_URL_RE.test(finalDomain)) {
        if (!finalLinkedin) finalLinkedin = finalDomain;
        finalDomain = '';
      }

      // ── URL normalization ──
      const invalid_urls: Record<string, string> = {};
      const liNorm = normalizeUrl(finalLinkedin);
      finalLinkedin = liNorm.url;
      if (liNorm.invalid_url_raw) invalid_urls.linkedin_url = liNorm.invalid_url_raw;

      const domNorm = normalizeUrl(finalDomain);
      finalDomain = domNorm.url;
      if (domNorm.invalid_url_raw) invalid_urls.company_domain = domNorm.invalid_url_raw;

      results.push({
        first_name: firstNonEmpty('first_name'),
        last_name: firstNonEmpty('last_name'),
        title: titlePick?.value || '',
        email: emailPick?.value || '',
        phone: phoneResult.phone_direct,
        phone_is_company: phoneResult.phone_is_company,
        phones_raw: phoneResult.phones_raw,
        linkedin_url: finalLinkedin,
        company_name: firstNonEmpty('company_name'),
        company_domain: finalDomain,
        industry: industryResult.industry,
        industry_raw: industryResult.industry_raw,
        employee_count: firstNonEmpty('employee_count'),
        hq_city: firstNonEmpty('hq_city'),
        hq_state: firstNonEmpty('hq_state'),
        invalid_urls,
        _sources: sources,
        _fields_merged: fields_merged,
      });
    }

    setMerged(results);
    // If triggers feature is enabled, show trigger tagging before preview
    if (triggersEnabled) {
      setStep('triggers');
    } else {
      setStep('preview');
    }
  };

  const handleTriggersSave = async (tags: TriggerTag[]) => {
    setBatchTriggers(tags);
    // Create a batch record in the database
    const campaignBatchId = `batch-${Date.now()}`;
    const sourceBatchId = files.map(f => f.name).join('+');
    try {
      const { data, error } = await supabase.from('lead_batches' as any).insert({
        campaign_batch_id: campaignBatchId,
        source_batch_id: sourceBatchId,
        manual_triggers: tags,
      } as any).select('batch_id').single();
      if (error) throw error;
      setBatchId((data as any).batch_id);
    } catch (err: any) {
      console.error('Batch creation error:', err);
      // Continue without batch — non-blocking
    }
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    let accountCount = 0;
    let contactCount = 0;
    let mergeCount = 0;

    try {
      for (const row of merged) {
        const canonical = canonicalCompanyName(row.company_name);
        const empCount = parseInt(row.employee_count) || null;
        // Final safeguard: never store LinkedIn URLs as company domain
        const cleanDomain = (row.company_domain && !LINKEDIN_URL_RE.test(row.company_domain)) ? row.company_domain : '';
        const linkedinUrl = row.linkedin_url || (LINKEDIN_URL_RE.test(row.company_domain) ? row.company_domain : '');

        // Find existing account by domain or canonical name
        let accountId: string | null = null;

        if (cleanDomain) {
          const { data } = await supabase.from('accounts').select('id').eq('domain', cleanDomain.toLowerCase()).limit(1);
          if (data && data.length > 0) { accountId = data[0].id; mergeCount++; }
        }

        if (!accountId && canonical) {
          const { data } = await supabase.from('accounts').select('id, canonical_company_name').eq('canonical_company_name', canonical).limit(1);
          if (data && data.length > 0) { accountId = data[0].id; mergeCount++; }
        }

        if (!accountId) {
          const isApolloOnly = files.every(f => f.source === 'Apollo' || f.source === 'Other');
          const { data, error } = await supabase.from('accounts').insert({
            name: row.company_name,
            domain: cleanDomain || null,
            canonical_company_name: canonical,
            industry: row.industry || null,
            employee_count: empCount,
            hq_city: row.hq_city || null,
            hq_state: row.hq_state || null,
            status: isApolloOnly ? 'waiting_for_zoominfo' : 'new',
            merge_keys: { domain: cleanDomain || undefined, canonical },
          } as any).select('id').single();
          if (error) { console.error('Account insert error:', error); continue; }
          accountId = data.id;
          accountCount++;
        } else {
          // If merging into existing account from Apollo-only, update status
          const isApolloOnly = files.every(f => f.source === 'Apollo' || f.source === 'Other');
          if (isApolloOnly) {
            await supabase.from('accounts').update({ status: 'waiting_for_zoominfo' } as any).eq('id', accountId);
          }
        }

        // Skip contact if no name
        if (!row.first_name && !row.last_name) continue;

        // Check for existing contact by email or linkedin
        let existingContactId: string | null = null;
        if (row.email) {
          const { data } = await supabase.from('contacts_le').select('id').eq('email', row.email).limit(1);
          if (data && data.length > 0) existingContactId = data[0].id;
        }
        if (!existingContactId && linkedinUrl) {
          const { data } = await supabase.from('contacts_le').select('id').eq('linkedin_url', linkedinUrl).limit(1);
          if (data && data.length > 0) existingContactId = data[0].id;
        }

        const importLogEntry = {
          timestamp: new Date().toISOString(),
          sources: row._sources,
          fields_merged: row._fields_merged,
          phones_raw: row.phones_raw,
          phone_is_company: row.phone_is_company,
          industry_raw: row.industry_raw,
          invalid_urls: Object.keys(row.invalid_urls).length > 0 ? row.invalid_urls : undefined,
        };

        if (existingContactId) {
          // Update existing contact with better data
          const updatePayload: any = {
            title: row.title || undefined,
            email: row.email || undefined,
            phone: row.phone || undefined,
            linkedin_url: linkedinUrl || undefined,
            account_id: accountId,
          };
          if (batchId) {
            updatePayload.batch_id = batchId;
            updatePayload.manual_triggers = batchTriggers;
            updatePayload.trigger_profile = batchTriggers;
          }
          await supabase.from('contacts_le').update(updatePayload).eq('id', existingContactId);
          mergeCount++;
        } else {
          const insertPayload: any = {
            first_name: row.first_name || 'Unknown',
            last_name: row.last_name || '',
            title: row.title || null,
            email: row.email || null,
            phone: row.phone || null,
            linkedin_url: linkedinUrl || null,
            account_id: accountId,
            import_log: [importLogEntry],
          };
          if (batchId) {
            insertPayload.batch_id = batchId;
            insertPayload.campaign_batch_id = `batch-${Date.now()}`;
            insertPayload.manual_triggers = batchTriggers;
            insertPayload.trigger_profile = batchTriggers;
          }
          await supabase.from('contacts_le').insert(insertPayload);
          contactCount++;
        }
      }

      setImportResult({ accounts: accountCount, contacts: contactCount, merged: mergeCount });
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast.success(`Import complete: ${accountCount} new accounts, ${contactCount} new contacts, ${mergeCount} merged`);

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'multi_source_import',
        entity_type: 'contacts_le',
        details: { accounts: accountCount, contacts: contactCount, merged: mergeCount, files: files.map(f => f.name) },
      });
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" /> Multi-Source Contact Import
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload multiple CSVs (SalesNavigator, Apollo, ZoomInfo, Zywave). The system will auto-detect source, normalize headers, and merge duplicates.
            </p>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={14} className="text-primary" />
                      <span className="text-sm text-foreground font-medium">{f.name}</span>
                      <Badge variant="outline" className="text-[10px]">{f.source}</Badge>
                      <span className="text-xs text-muted-foreground">{f.rows.length} rows</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      setFiles(prev => prev.filter((_, j) => j !== i));
                      setFileMappings(prev => {
                        const next = { ...prev };
                        delete next[i];
                        return next;
                      });
                    }}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.xlsx,.xls';
                input.multiple = true;
                input.onchange = (e) => {
                  const fileList = (e.target as HTMLInputElement).files;
                  if (fileList) Array.from(fileList).forEach(addFile);
                };
                input.click();
              }}
            >
              <Plus size={32} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-foreground">Add CSV files</p>
            </div>

            {files.length > 0 && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleShowMapping}>
                  Review Mapping <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review how your CSV columns map to contact fields. Fix any <span className="text-destructive font-medium">unmapped</span> fields below.
            </p>

            {files.map((f, fileIdx) => {
              const mapping = fileMappings[fileIdx] || {};
              const unmappedHeaders = f.headers.filter(h => !Object.values(mapping).includes(h));
              const missingRequired = REQUIRED_FIELDS.filter(field => !mapping[field]);

              return (
                <div key={fileIdx} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={14} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">{f.name}</span>
                    <Badge variant="outline" className="text-[10px]">{f.source}</Badge>
                    <span className="text-xs text-muted-foreground">{f.rows.length} rows · {f.headers.length} columns</span>
                  </div>

                  {missingRequired.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                      <AlertTriangle size={12} />
                      Missing required: {missingRequired.map(f => FIELD_LABELS[f]).join(', ')}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(FIELD_LABELS).map(field => {
                      const currentHeader = mapping[field] || '';
                      const isMapped = !!currentHeader;
                      const isRequired = REQUIRED_FIELDS.includes(field);

                      return (
                        <div key={field} className="flex items-center gap-2">
                          <div className="flex items-center gap-1 w-32 shrink-0">
                            {isMapped ? (
                              <Check size={12} className="text-primary shrink-0" />
                            ) : (
                              <AlertTriangle size={12} className={`shrink-0 ${isRequired ? 'text-destructive' : 'text-muted-foreground'}`} />
                            )}
                            <span className={`text-xs truncate ${isRequired && !isMapped ? 'text-destructive font-medium' : 'text-foreground'}`}>
                              {FIELD_LABELS[field]}{isRequired ? ' *' : ''}
                            </span>
                          </div>
                          <Select
                            value={currentHeader || '__none__'}
                            onValueChange={(val) => updateFieldMapping(fileIdx, field, val)}
                          >
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder="Not mapped" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="text-muted-foreground">— Not mapped —</span>
                              </SelectItem>
                              {f.headers.map(h => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                  {f.rows[0]?.[h] ? ` (e.g. "${String(f.rows[0][h]).slice(0, 30)}")` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>

                  {unmappedHeaders.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Unused columns:</span>{' '}
                      {unmappedHeaders.map(h => h).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>Back</Button>
              <Button size="sm" onClick={handleMerge}>
                Merge & Preview <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 'triggers' && (
          <div className="space-y-4">
            <TriggerPanel onSave={handleTriggersSave} initialTags={batchTriggers} />
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>Back</Button>
              <Button variant="ghost" size="sm" onClick={() => { setBatchTriggers([]); setStep('preview'); }}>
                Skip — No Triggers
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{merged.length}</span> unique contacts/companies after deduplication from {files.length} files.
            </p>

            {batchTriggers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-muted-foreground">Batch triggers:</span>
                {batchTriggers.map(t => (
                  <Badge key={t.label} variant="secondary" className="text-[10px]">{t.label}</Badge>
                ))}
              </div>
            )}

            <div className="overflow-x-auto border border-border rounded max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="text-xs">Name</TableHead>
                     <TableHead className="text-xs">Company</TableHead>
                     <TableHead className="text-xs">Title</TableHead>
                     <TableHead className="text-xs">Email</TableHead>
                     <TableHead className="text-xs">Phone</TableHead>
                     <TableHead className="text-xs">Industry</TableHead>
                     <TableHead className="text-xs">LinkedIn</TableHead>
                     <TableHead className="text-xs">Sources</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merged.slice(0, 50).map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{m.first_name} {m.last_name}</TableCell>
                      <TableCell className="text-xs">{m.company_name}</TableCell>
                      <TableCell className="text-xs">{m.title || '—'}</TableCell>
                      <TableCell className="text-xs">{m.email || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {m.phone ? (
                          <span>{m.phone}{m.phone_is_company && <span className="text-muted-foreground ml-1">(Company)</span>}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">{m.industry || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {m.linkedin_url ? (
                          <>✓{m.invalid_urls.linkedin_url && <span className="text-destructive ml-1" title={`Invalid source URL (kept raw): ${m.invalid_urls.linkedin_url}`}>!</span>}</>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {m._sources.map(s => <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(triggersEnabled ? 'triggers' : 'mapping')}>Back</Button>
              <Button size="sm" onClick={handleImport}>
                Import {merged.length} Records <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-12">
            <Loader2 size={40} className="mx-auto animate-spin text-primary mb-4" />
            <p className="text-sm text-foreground">Importing and merging records...</p>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-primary" />
            <p className="text-sm font-medium text-foreground">Import Complete</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{importResult.accounts} new accounts created</p>
              <p>{importResult.contacts} new contacts added</p>
              <p>{importResult.merged} records merged with existing data</p>
            </div>
            <Button size="sm" onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
