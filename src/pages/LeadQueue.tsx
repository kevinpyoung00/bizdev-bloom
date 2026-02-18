import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/crm/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Eye, Loader2, CheckCircle2, X, Upload, FileUp, AlertTriangle, RotateCcw, Radar, Settings2, Trash2, Mail, Phone, Linkedin, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLeadQueue, useRunScoring, useRunDiscovery, type QueueScope, type DiscoveryRunParams } from '@/hooks/useLeadEngine';
import { useClaimLead, useRejectLead, useMarkUploaded, useRejectedLeads, useRestoreLead, useBulkClaimLeads, useBulkReviewLeads, useBulkRejectLeads, useBulkRestoreLeads, REJECT_REASONS } from '@/hooks/useLeadActions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import AccountDrawer from '@/components/lead-engine/AccountDrawer';
import { DualStarsBadge, StarsLegend } from '@/components/lead-engine/DualStarsBadge';
import LeadStatusBadge from '@/components/lead-engine/LeadStatusBadge';
import D365StatusBadge from '@/components/lead-engine/D365StatusBadge';
import SignalChips, { buildChipsFromTriggers, buildPillsFromLeadSignals } from '@/components/crm/SignalChips';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SuggestedPersonaBadge from '@/components/SuggestedPersonaBadge';
import IndustryChip from '@/components/lead-engine/IndustryChip';
import { exportD365CheckCSV, exportD365Workbook, ImportD365Results, ImportD365Success } from '@/components/lead-engine/D365ExportImport';
import BulkCampaignModal from '@/components/lead-engine/BulkCampaignModal';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import MultiSourceImporter from '@/components/lead-engine/MultiSourceImporter';
import NeedsReviewTab from '@/components/lead-engine/NeedsReviewTab';
import { recommendPersona } from '@/lib/personaRecommend';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';
import DiscoveryControlPanel, { type DiscoveryPanelParams } from '@/components/lead-engine/DiscoveryControlPanel';
import PreviewCandidatesDrawer, { type PreviewCandidate } from '@/components/lead-engine/PreviewCandidatesDrawer';
import DiscoverySummaryChip, { type DiscoverySummaryData } from '@/components/lead-engine/DiscoverySummaryChip';

// ── Signal Pills Row with tooltips ──
function SignalPillsRow({ leadSignals, triggers }: { leadSignals: any; triggers: any }) {
  const pills = buildPillsFromLeadSignals(leadSignals, triggers);
  if (pills.length === 0) return <span className="text-xs text-muted-foreground italic">No signals</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[5px] whitespace-nowrap cursor-default border ${
              pill.variant === 'default' ? 'bg-primary text-primary-foreground border-primary' :
              pill.variant === 'destructive' ? 'bg-destructive text-destructive-foreground border-destructive' :
              pill.variant === 'secondary' ? 'bg-secondary text-secondary-foreground border-secondary' :
              'bg-background text-foreground border-border'
            }`}>
              {pill.icon} {pill.label}
            </span>
          </TooltipTrigger>
          {pill.tooltip && <TooltipContent className="text-xs max-w-[240px]">{pill.tooltip}</TooltipContent>}
        </Tooltip>
      ))}
    </div>
  );
}

// ── localStorage helpers ──
const STORAGE_KEY = 'lead-queue-filters';
function loadFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { scope?: QueueScope; hideOwned?: boolean; showNeedsReviewOnly?: boolean };
  } catch { return null; }
}
function saveFilters(f: { scope: QueueScope; hideOwned: boolean; showNeedsReviewOnly: boolean }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

// ── Export claimed ──
async function exportClaimedExcel(leads: LeadWithAccount[]) {
  const claimed = leads.filter(l => (l as any).claim_status === 'claimed');
  if (claimed.length === 0) { toast.info('No claimed leads to export'); return; }

  const accountIds = claimed.map(l => l.account.id);
  const { data: contacts } = await supabase.from('contacts_le').select('*').in('account_id', accountIds);
  const contactsByAccount = new Map<string, any[]>();
  for (const c of contacts || []) {
    if (!c.account_id) continue;
    if (!contactsByAccount.has(c.account_id)) contactsByAccount.set(c.account_id, []);
    contactsByAccount.get(c.account_id)!.push(c);
  }

  const rows: any[] = [];
  for (const lead of claimed) {
    const acctContacts = contactsByAccount.get(lead.account.id) || [];
    const base = {
      'Account Name': lead.account.name,
      Website: lead.account.website || lead.account.domain || '',
      'HQ City': lead.account.hq_city || '',
      'HQ State': lead.account.hq_state || '',
      Industry: lead.account.industry || '',
      'Employee Count': lead.account.employee_count || '',
      Notes: lead.account.notes || '',
      'Claimed On': (lead as any).claimed_at || '',
    };

    if (acctContacts.length === 0) {
      rows.push({ ...base, 'First Name': '', 'Last Name': '', Title: '', Email: '', Phone: '', 'LinkedIn URL': '', 'Persona (Auto)': (lead as any).persona || '' });
    } else {
      for (const c of acctContacts) {
        rows.push({ ...base, 'First Name': c.first_name, 'Last Name': c.last_name, Title: c.title || '', Email: c.email || '', Phone: c.phone || '', 'LinkedIn URL': c.linkedin_url || '', 'Persona (Auto)': (lead as any).persona || '' });
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'D365 Export');
  XLSX.writeFile(wb, `d365-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  toast.success(`Exported ${claimed.length} claimed leads (${rows.length} rows)`);

  try {
    await supabase.from('audit_log').insert({
      actor: 'user', action: 'export_claimed',
      entity_type: 'lead_queue',
      details: { count: claimed.length, rows: rows.length },
    });
  } catch (_) { /* non-critical */ }
}

// ── Counter bar ──
function CounterBar({ leads, hideOwned }: { leads: LeadWithAccount[]; hideOwned: boolean }) {
  const d365 = { unknown: 0, unowned: 0, owned: 0, duplicate_inactive: 0 };
  const claim = { new: 0, claimed: 0, rejected: 0 };
  let needsReview = 0;

  for (const l of leads) {
    const ds = (l.account as any).d365_status || 'unknown';
    if (ds in d365) d365[ds as keyof typeof d365]++;
    const cs = (l as any).claim_status || 'new';
    if (cs in claim) claim[cs as keyof typeof claim]++;
    if ((l.account as any).needs_review) needsReview++;
  }

  return (
    <p className="text-[11px] text-muted-foreground leading-relaxed">
      Total: {leads.length}
      {' · D365 → '}unknown {d365.unknown} · unowned {d365.unowned} · owned {d365.owned} · dup/inactive {d365.duplicate_inactive}
      {' · Claim → '}new {claim.new} · claimed {claim.claimed} · rejected {claim.rejected}
      {' · NeedsReview '}{needsReview}
      {hideOwned && <span className="text-orange-500 ml-1">(owned hidden)</span>}
    </p>
  );
}

export default function LeadQueue() {
  const [searchParams] = useSearchParams();
  const debugMode = searchParams.get('debug') === '1';

  const saved = loadFilters();
  const [scope, setScope] = useState<QueueScope>(saved?.scope || 'today');
  const [hideOwned, setHideOwned] = useState(saved?.hideOwned ?? false);
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState(saved?.showNeedsReviewOnly ?? false);

  useEffect(() => { saveFilters({ scope, hideOwned, showNeedsReviewOnly }); }, [scope, hideOwned, showNeedsReviewOnly]);

  const { data: leads = [], isLoading } = useLeadQueue(scope);
  const { data: rejectedLeads = [] } = useRejectedLeads();
  const runScoring = useRunScoring();
  const runDiscovery = useRunDiscovery();
  const claimLead = useClaimLead();
  const rejectLead = useRejectLead();
  const markUploaded = useMarkUploaded();
  const restoreLead = useRestoreLead();
  const bulkClaim = useBulkClaimLeads();
  const bulkReview = useBulkReviewLeads();
  const bulkReject = useBulkRejectLeads();
  const bulkRestore = useBulkRestoreLeads();
  const [selectedLead, setSelectedLead] = useState<LeadWithAccount | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectedSelectedIds, setRejectedSelectedIds] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [importD365Open, setImportD365Open] = useState(false);
  const [multiImportOpen, setMultiImportOpen] = useState(false);
  const [d365SuccessOpen, setD365SuccessOpen] = useState(false);
  const [bulkCampaignOpen, setBulkCampaignOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');

  // Feature flags
  const d365ExportEnabled = useFeatureFlag('bizdev_d365_export');
  const campaignBulkEnabled = useFeatureFlag('bizdev_campaign_bulk');

  // Discovery state
  const [discoveryPanelOpen, setDiscoveryPanelOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [discoverySummary, setDiscoverySummary] = useState<DiscoverySummaryData | null>(null);
  const [previewCandidates, setPreviewCandidates] = useState<PreviewCandidate[]>([]);
  const [keptBySubtype, setKeptBySubtype] = useState<Record<string, number>>({});

  const filteredLeads = leads.filter(l => {
    const d365Status = (l.account as any).d365_status || 'unknown';
    if (hideOwned && d365Status === 'owned') return false;
    if (showNeedsReviewOnly && !(l.account as any).needs_review) return false;
    return true;
  });

  const handleView = (lead: LeadWithAccount) => { setSelectedLead(lead); setDrawerOpen(true); };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLeads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  };

  const allSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length;

  const handleMarkUploaded = () => {
    const claimedIds = leads
      .filter(l => selectedIds.has(l.id) && (l as any).claim_status === 'claimed')
      .map(l => l.id);
    if (claimedIds.length === 0) { toast.info('Select claimed leads to mark as uploaded'); return; }
    markUploaded.mutate(claimedIds);
    setSelectedIds(new Set());
  };

  const handleClaim = (lead: LeadWithAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    const d365Status = (lead.account as any).d365_status || 'unknown';
    if (d365Status !== 'unowned' && d365Status !== 'unknown') {
      toast.error('Only unowned/unknown accounts can be claimed');
      return;
    }
    claimLead.mutate({
      leadId: lead.id,
      contactTitle: undefined,
      accountIndustry: lead.account.industry || undefined,
    });
  };

  const handleReject = (leadId: string, reason: string) => {
    rejectLead.mutate({ leadId, reason });
    setRejectingId(null);
  };

  const handleNeedsReview = async (lead: LeadWithAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('accounts').update({ needs_review: true } as any).eq('id', lead.account.id);
    toast.success('Sent to Needs Review');
  };

  const handleClaimAllVisible = () => {
    const claimable = filteredLeads.filter(l => {
      const d365Status = (l.account as any).d365_status || 'unknown';
      const claimStatus = (l as any).claim_status || 'new';
      return d365Status === 'unowned' && claimStatus === 'new';
    });
    if (claimable.length === 0) { toast.info('No claimable leads visible'); return; }
    for (const lead of claimable) {
      claimLead.mutate({
        leadId: lead.id,
        contactTitle: undefined,
        accountIndustry: lead.account.industry || undefined,
      });
    }
  };

  // ── Bulk action handlers ──
  const handleBulkClaim = () => {
    const eligible = filteredLeads.filter(l =>
      selectedIds.has(l.id) &&
      ((l.account as any).d365_status === 'unowned' || (l.account as any).d365_status === 'unknown') &&
      ((l as any).claim_status === 'new')
    );
    if (eligible.length === 0) { toast.info('No eligible leads to claim in selection'); return; }
    bulkClaim.mutate(eligible.map(l => l.id), { onSuccess: () => setSelectedIds(new Set()) });
  };

  const handleBulkReview = () => {
    const accountIds = filteredLeads.filter(l => selectedIds.has(l.id)).map(l => l.account.id);
    if (accountIds.length === 0) return;
    bulkReview.mutate(accountIds, { onSuccess: () => setSelectedIds(new Set()) });
  };

  const handleBulkReject = () => {
    const ids = filteredLeads.filter(l => selectedIds.has(l.id)).map(l => l.id);
    if (ids.length === 0) return;
    bulkReject.mutate({ leadIds: ids, reason: 'bulk_reject_invalid_discovery' }, { onSuccess: () => setSelectedIds(new Set()) });
  };

  const handleBulkRestore = () => {
    const ids = Array.from(rejectedSelectedIds);
    if (ids.length === 0) return;
    bulkRestore.mutate(ids, { onSuccess: () => setRejectedSelectedIds(new Set()) });
  };

  const toggleRejectedSelect = (id: string) => {
    setRejectedSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllRejected = () => {
    if (rejectedSelectedIds.size === rejectedLeads.length) setRejectedSelectedIds(new Set());
    else setRejectedSelectedIds(new Set(rejectedLeads.map((l: any) => l.id)));
  };

  const allRejectedSelected = rejectedLeads.length > 0 && rejectedSelectedIds.size === rejectedLeads.length;

  // Auto-discovery handler
  const handleAutoDiscovery = () => {
    runDiscovery.mutate({ mode: 'auto' }, {
      onSuccess: (data) => {
        setDiscoverySummary(data);
        setPreviewCandidates(data.preview_candidates || []);
        setKeptBySubtype(data.kept_by_subtype || {});
      },
    });
  };

  // Manual discovery handler
  const handleManualDiscovery = (params: DiscoveryPanelParams) => {
    const runParams: DiscoveryRunParams = {
      mode: 'manual',
      params: {
        industries: params.industries,
        triggers: params.triggers,
        geography: params.geography,
        company_size: params.company_size,
        discovery_type: params.discovery_type,
        result_count: params.result_count,
      },
      override_ma_ne: params.override_ma_ne,
    };
    runDiscovery.mutate(runParams, {
      onSuccess: (data) => {
        setDiscoverySummary(data);
        setPreviewCandidates(data.preview_candidates || []);
        setKeptBySubtype(data.kept_by_subtype || {});
        setDiscoveryPanelOpen(false);
        if (params.score_after) {
          runScoring.mutate(false);
        }
      },
    });
  };

  const needsReviewCount = leads.filter(l => (l.account as any).needs_review).length;

  // ── Purge Today's Batch ──
  const handlePurgeToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    const todayUnclaimed = leads.filter(l => {
      const cs = (l as any).claim_status || 'new';
      return cs === 'new' && l.run_date === today;
    });
    if (todayUnclaimed.length === 0) { toast.info('No unclaimed leads from today to purge'); return; }
    const ids = todayUnclaimed.map(l => l.id);
    bulkReject.mutate(
      { leadIds: ids, reason: 'purge_today_batch' },
      {
        onSuccess: () => {
          toast.success(`Purged ${ids.length} unclaimed leads from today`);
          setSelectedIds(new Set());
        },
      }
    );
  };

  // ── Empty state ──
  const renderEmptyState = () => {
    if (leads.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={12} className="text-center py-12">
            <div className="space-y-3">
              <p className="text-muted-foreground">No leads for the selected scope. Try running scoring or changing the scope to "Last 7 days".</p>
              <p className="text-xs text-muted-foreground">Owned accounts may be hidden — unhide in Filters.</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => runScoring.mutate(false)} disabled={runScoring.isPending}>
                  {runScoring.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} Run Scoring
                </Button>
                {scope === 'today' && (
                  <Button size="sm" variant="outline" onClick={() => setScope('7d')}>Switch to Last 7 days</Button>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      );
    }
    return (
      <TableRow>
        <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
          No leads match current filters. Uncheck "Hide Owned" or "Show Needs Review only".
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Queue</h1>
            <CounterBar leads={leads} hideOwned={hideOwned} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleAutoDiscovery} disabled={runDiscovery.isPending}>
              {runDiscovery.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Radar size={16} className="mr-1" />}
              Run Auto-Discovery
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDiscoveryPanelOpen(true)}>
              <Settings2 size={16} className="mr-1" /> Discovery Panel
            </Button>
            <Button variant="outline" size="sm" onClick={() => runScoring.mutate(false)} disabled={runScoring.isPending}>
              {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : null}
              Run Scoring
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportD365CheckCSV(leads)}>
              <Download size={16} className="mr-1" /> Export to D365 Check
            </Button>
            {d365ExportEnabled && (
              <Button variant="outline" size="sm" onClick={async () => {
                const claimedLeads = leads.filter(l => (l as any).claim_status === 'claimed');
                const accountIds = claimedLeads.map(l => l.account.id);
                const { data: contacts } = await supabase.from('contacts_le').select('*').in('account_id', accountIds);
                exportD365Workbook(claimedLeads, contacts || []);
              }}>
                <Download size={16} className="mr-1" /> Export D365 Workbook
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setImportD365Open(true)}>
              <Upload size={16} className="mr-1" /> Import D365 Results
            </Button>
            {d365ExportEnabled && (
              <Button variant="outline" size="sm" onClick={() => setD365SuccessOpen(true)}>
                <CheckCircle2 size={16} className="mr-1" /> Import D365 Success
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setMultiImportOpen(true)}>
              <FileUp size={16} className="mr-1" /> Multi-Source Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportClaimedExcel(leads)}>
              <Download size={16} className="mr-1" /> Export Claimed
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkUploaded} disabled={markUploaded.isPending || selectedIds.size === 0}>
              {markUploaded.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <CheckCircle2 size={16} className="mr-1" />}
              Mark Uploaded
            </Button>
          </div>
        </div>

        {/* Discovery Summary Chip */}
        {discoverySummary && (
          <DiscoverySummaryChip
            data={discoverySummary}
            onViewPreview={() => setPreviewOpen(true)}
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="queue">Lead Queue</TabsTrigger>
            <TabsTrigger value="needs-review" className="flex items-center gap-1">
              Needs Review
              {needsReviewCount > 0 && (
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 ml-1">{needsReviewCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-1">
              Rejected
              {rejectedLeads.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{rejectedLeads.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4">
            <StarsLegend />

            {/* Scope selector + Filters */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Scope:</span>
                <Button size="sm" variant={scope === 'today' ? 'default' : 'outline'} className="h-7 text-xs px-3" onClick={() => setScope('today')}>Today</Button>
                <Button size="sm" variant={scope === '7d' ? 'default' : 'outline'} className="h-7 text-xs px-3" onClick={() => setScope('7d')}>Last 7 days</Button>
                <Button size="sm" variant={scope === 'all' ? 'default' : 'outline'} className="h-7 text-xs px-3" onClick={() => setScope('all')}>All</Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={hideOwned} onCheckedChange={setHideOwned} id="hide-owned" />
                <label htmlFor="hide-owned" className="text-xs text-muted-foreground cursor-pointer">Hide Owned</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={showNeedsReviewOnly} onCheckedChange={setShowNeedsReviewOnly} id="needs-review-only" />
                <label htmlFor="needs-review-only" className="text-xs text-muted-foreground cursor-pointer">Show Needs Review only</label>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleClaimAllVisible}>
                <CheckCircle2 size={12} className="mr-1" /> Claim all visible claimable
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={handlePurgeToday}>
                <Trash2 size={12} className="mr-1" /> Purge Today's Batch
              </Button>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                <span className="text-xs font-medium text-foreground mr-2">{selectedIds.size} selected</span>
                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleBulkClaim} disabled={bulkClaim.isPending}>
                  {bulkClaim.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <CheckCircle2 size={12} className="mr-1" />}
                  Claim Selected
                </Button>
                <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white" onClick={handleBulkReview} disabled={bulkReview.isPending}>
                  {bulkReview.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <AlertTriangle size={12} className="mr-1" />}
                  Review Selected
                </Button>
                <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={handleBulkReject} disabled={bulkReject.isPending}>
                  {bulkReject.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <X size={12} className="mr-1" />}
                  Reject Selected
                </Button>
                {campaignBulkEnabled && (
                  <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setBulkCampaignOpen(true)}>
                    <Users size={12} className="mr-1" /> Add to Campaign
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                      </TableHead>
                      <TableHead className="w-14">Rank</TableHead>
                      <TableHead className="w-28">Priority</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="w-28">Industry</TableHead>
                      <TableHead className="w-20">Emp.</TableHead>
                      <TableHead className="w-16">Region</TableHead>
                      <TableHead>Signals</TableHead>
                      <TableHead className="w-36">Contact / Persona</TableHead>
                      <TableHead className="w-28">D365</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-40">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={12} className="text-center py-12 text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading leads...</TableCell></TableRow>
                    ) : filteredLeads.length === 0 ? (
                      renderEmptyState()
                    ) : (
                      filteredLeads.map((lead) => {
                        const claimStatus = (lead as any).claim_status || 'new';
                        const d365Status = (lead.account as any).d365_status || 'unknown';
                        const rec = recommendPersona(lead.account.employee_count, lead.industry_key, lead.reason);
                        return (
                          <TableRow
                            key={lead.id}
                            className={`cursor-pointer ${selectedIds.has(lead.id) ? 'bg-accent/50' : ''}`}
                            onClick={() => toggleSelect(lead.id)}
                          >
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{lead.priority_rank}</TableCell>
                            <TableCell><DualStarsBadge lead={lead} /></TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-foreground">{lead.account.name}</span>
                                <Button size="sm" className="h-7 mt-1 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md w-fit" onClick={(e) => { e.stopPropagation(); handleView(lead); }}>
                                  Details
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell><IndustryChip industry={lead.account.industry} /></TableCell>
                            <TableCell className="text-foreground">{lead.account.employee_count || '—'}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{lead.account.geography_bucket}</Badge></TableCell>
                            <TableCell className="max-w-[260px]">
                              <SignalPillsRow leadSignals={lead.reason?.lead_signals} triggers={lead.account.triggers} />
                            </TableCell>
                            <TableCell>
                              {lead.primaryContact ? (
                                <div className="space-y-0.5">
                                  <span className="text-xs font-medium text-foreground truncate max-w-[140px] block">
                                    {lead.primaryContact.first_name} {lead.primaryContact.last_name}
                                  </span>
                                  {lead.primaryContact.title && (
                                    <p className="text-[9px] text-muted-foreground truncate max-w-[140px]">{lead.primaryContact.title}</p>
                                  )}
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Mail size={10} className={lead.primaryContact.email ? 'text-primary' : 'text-muted-foreground/30'} />
                                    <Phone size={10} className={lead.primaryContact.phone ? 'text-primary' : 'text-muted-foreground/30'} />
                                    <Linkedin size={10} className={lead.primaryContact.linkedin_url ? 'text-primary' : 'text-muted-foreground/30'} />
                                  </div>
                                </div>
                              ) : (
                                <SuggestedPersonaBadge
                                  employeeCount={lead.account.employee_count}
                                  industryKey={lead.industry_key}
                                  signals={lead.reason}
                                  companyName={lead.account.name}
                                  zywaveId={lead.account.zywave_id}
                                  variant="compact"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <D365StatusBadge
                                status={d365Status}
                                ownerName={lead.account.d365_owner_name}
                                d365AccountId={(lead.account as any).d365_account_id}
                              />
                            </TableCell>
                            <TableCell><LeadStatusBadge status={claimStatus} /></TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col items-center gap-1">
                                {claimStatus === 'new' && (
                                  <>
                                    <Button size="sm" className="h-7 w-full rounded-full bg-green-600 hover:bg-green-700 text-white text-[10px] px-3" onClick={(e) => handleClaim(lead, e)} disabled={claimLead.isPending}>
                                      <CheckCircle2 size={12} className="mr-1" /> Claim
                                    </Button>
                                    <Button size="sm" className="h-7 w-full rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-3" onClick={(e) => handleNeedsReview(lead, e)}>
                                      <AlertTriangle size={12} className="mr-1" /> Review
                                    </Button>
                                    {rejectingId === lead.id ? (
                                      <Select onValueChange={(v) => handleReject(lead.id, v)}>
                                        <SelectTrigger className="h-7 w-full text-[10px] rounded-full">
                                          <SelectValue placeholder="Reason" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {REJECT_REASONS.map(r => (
                                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Button size="sm" className="h-7 w-full rounded-full bg-red-600 hover:bg-red-700 text-white text-[10px] px-3" onClick={() => setRejectingId(lead.id)}>
                                        <X size={12} className="mr-1" /> Reject
                                    </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="needs-review">
            <Card>
              <CardContent className="p-0">
                <NeedsReviewTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            {rejectedSelectedIds.size > 0 && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-muted/50 border border-border rounded-lg">
                <span className="text-xs font-medium text-foreground mr-2">{rejectedSelectedIds.size} selected</span>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkRestore} disabled={bulkRestore.isPending}>
                  {bulkRestore.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <RotateCcw size={12} className="mr-1" />}
                  Restore Selected
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRejectedSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allRejectedSelected} onCheckedChange={toggleAllRejected} aria-label="Select all rejected" />
                      </TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Rejected At</TableHead>
                      <TableHead className="w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No rejected leads.</TableCell>
                      </TableRow>
                    ) : (
                      rejectedLeads.map((lead: any) => (
                        <TableRow key={lead.id} className={rejectedSelectedIds.has(lead.id) ? 'bg-accent/50' : ''}>
                          <TableCell>
                            <Checkbox checked={rejectedSelectedIds.has(lead.id)} onCheckedChange={() => toggleRejectedSelect(lead.id)} />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{lead.account?.name || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.rejected_reason || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.rejected_at ? new Date(lead.rejected_at).toLocaleDateString() : '—'}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => restoreLead.mutate(lead.id)} disabled={restoreLead.isPending}>
                              <RotateCcw size={12} /> Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AccountDrawer lead={selectedLead} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ImportD365Results open={importD365Open} onOpenChange={setImportD365Open} />
      <ImportD365Success open={d365SuccessOpen} onOpenChange={setD365SuccessOpen} />
      <MultiSourceImporter open={multiImportOpen} onOpenChange={setMultiImportOpen} />
      <BulkCampaignModal
        open={bulkCampaignOpen}
        onOpenChange={setBulkCampaignOpen}
        selectedLeadIds={Array.from(selectedIds)}
        onComplete={() => setSelectedIds(new Set())}
      />
      <DiscoveryControlPanel
        open={discoveryPanelOpen}
        onOpenChange={setDiscoveryPanelOpen}
        onRun={handleManualDiscovery}
        isRunning={runDiscovery.isPending}
      />
      <PreviewCandidatesDrawer
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        candidates={previewCandidates}
        onProceedToScore={() => runScoring.mutate(false)}
        isScoringPending={runScoring.isPending}
        keptBySubtype={keptBySubtype}
      />
    </Layout>
  );
}
