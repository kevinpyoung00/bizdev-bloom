import { useState } from 'react';
import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, RefreshCw, Download, Table2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

function sanitize(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

async function fetchExportData() {
  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('*')
    .order('icp_score', { ascending: false });
  if (accErr) throw accErr;

  const { data: contacts, error: conErr } = await supabase
    .from('contacts_le')
    .select('*');
  if (conErr) throw conErr;

  return { accounts: accounts ?? [], contacts: contacts ?? [] };
}

function buildAccountRows(accounts: any[]) {
  return accounts.map((a) => ({
    Name: sanitize(a.name),
    Domain: sanitize(a.domain),
    Website: sanitize(a.website),
    Industry: sanitize(a.industry),
    'Sub-Industry': sanitize(a.sub_industry),
    'NAICS Code': sanitize(a.naics_code),
    Employees: a.employee_count ?? '',
    'Revenue Range': sanitize(a.revenue_range),
    'HQ City': sanitize(a.hq_city),
    'HQ State': sanitize(a.hq_state),
    'HQ Country': sanitize(a.hq_country),
    'Geography Bucket': sanitize(a.geography_bucket),
    'ICP Score': a.icp_score ?? '',
    Status: sanitize(a.status),
    Source: sanitize(a.source),
    Notes: sanitize(a.notes),
  }));
}

function buildContactRows(contacts: any[], accountMap: Map<string, any>) {
  return contacts.map((c) => {
    const acct = c.account_id ? accountMap.get(c.account_id) : null;
    return {
      'First Name': sanitize(c.first_name),
      'Last Name': sanitize(c.last_name),
      'Job Title': sanitize(c.title),
      Department: sanitize(c.department),
      Seniority: sanitize(c.seniority),
      Email: sanitize(c.email),
      Phone: sanitize(c.phone),
      LinkedIn: sanitize(c.linkedin_url),
      Location: sanitize(c.location),
      'Primary Contact': c.is_primary ? 'Yes' : 'No',
      'Company Name': acct ? sanitize(acct.name) : '',
      'Company Domain': acct ? sanitize(acct.domain) : '',
    };
  });
}

// D365 maps to specific column names for import
function buildD365AccountRows(accounts: any[]) {
  return accounts.map((a) => ({
    'Account Name': sanitize(a.name),
    'Main Phone': '',
    'Website': sanitize(a.website || a.domain),
    'Address 1: Street 1': '',
    'Address 1: City': sanitize(a.hq_city),
    'Address 1: State/Province': sanitize(a.hq_state),
    'Address 1: ZIP/Postal Code': '',
    'Address 1: Country/Region': sanitize(a.hq_country || 'US'),
    'Industry': sanitize(a.industry),
    'Number of Employees': a.employee_count ?? '',
    'Annual Revenue': sanitize(a.revenue_range),
    'Description': sanitize(a.notes),
  }));
}

function buildD365ContactRows(contacts: any[], accountMap: Map<string, any>) {
  return contacts.map((c) => {
    const acct = c.account_id ? accountMap.get(c.account_id) : null;
    return {
      'First Name': sanitize(c.first_name),
      'Last Name': sanitize(c.last_name),
      'Job Title': sanitize(c.title),
      'Email Address 1': sanitize(c.email),
      'Business Phone': sanitize(c.phone),
      'Company Name': acct ? sanitize(acct.name) : '',
      'Department': sanitize(c.department),
      'Address 1: City': sanitize(c.location),
    };
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function exportCSV(rows: any[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
}

function exportD365Excel(accountRows: any[], contactRows: any[], filename: string) {
  const wb = XLSX.utils.book_new();
  const wsAccounts = XLSX.utils.json_to_sheet(accountRows);
  const wsContacts = XLSX.utils.json_to_sheet(contactRows);
  XLSX.utils.book_append_sheet(wb, wsAccounts, 'Accounts');
  XLSX.utils.book_append_sheet(wb, wsContacts, 'Contacts');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

export default function Enrichment() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: 'csv-accounts' | 'csv-contacts' | 'd365') => {
    setExporting(type);
    try {
      const { accounts, contacts } = await fetchExportData();
      const accountMap = new Map(accounts.map((a) => [a.id, a]));
      const dateSuffix = new Date().toISOString().split('T')[0];

      if (type === 'csv-accounts') {
        exportCSV(buildAccountRows(accounts), `accounts_export_${dateSuffix}.csv`);
        toast({ title: 'Exported', description: `${accounts.length} accounts downloaded as CSV.` });
      } else if (type === 'csv-contacts') {
        exportCSV(buildContactRows(contacts, accountMap), `contacts_export_${dateSuffix}.csv`);
        toast({ title: 'Exported', description: `${contacts.length} contacts downloaded as CSV.` });
      } else {
        const d365Accts = buildD365AccountRows(accounts);
        const d365Contacts = buildD365ContactRows(contacts, accountMap);
        exportD365Excel(d365Accts, d365Contacts, `D365_Import_${dateSuffix}.xlsx`);
        toast({ title: 'Exported', description: `D365 Excel with ${accounts.length} accounts & ${contacts.length} contacts.` });
      }
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enrichment</h1>
          <p className="text-sm text-muted-foreground">Import data from ZoomInfo/Zywave CSV &amp; export for D365 or CSV</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload size={20} /> CSV Upload
              </CardTitle>
              <CardDescription>Upload ZoomInfo or Zywave exports with auto-mapping</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <FileSpreadsheet size={40} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">Drag &amp; drop a CSV or XLSX file</p>
                <Button variant="outline" size="sm">Browse Files</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download size={20} /> Export Data
              </CardTitle>
              <CardDescription>Download accounts &amp; contacts as CSV or D365-formatted Excel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={exporting !== null}
                onClick={() => handleExport('csv-accounts')}
              >
                <FileSpreadsheet size={16} />
                {exporting === 'csv-accounts' ? 'Exporting…' : 'Export Accounts CSV'}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={exporting !== null}
                onClick={() => handleExport('csv-contacts')}
              >
                <FileSpreadsheet size={16} />
                {exporting === 'csv-contacts' ? 'Exporting…' : 'Export Contacts CSV'}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={exporting !== null}
                onClick={() => handleExport('d365')}
              >
                <Table2 size={16} />
                {exporting === 'd365' ? 'Exporting…' : 'Export D365 Excel (.xlsx)'}
              </Button>
              <p className="text-xs text-muted-foreground">D365 Excel produces a two-sheet workbook (Accounts + Contacts) mapped to Dynamics 365 import columns.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw size={20} /> Recent Imports
            </CardTitle>
            <CardDescription>History of enrichment runs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
