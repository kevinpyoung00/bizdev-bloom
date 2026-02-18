import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Mail, Upload, Download, CheckCircle2, ArrowRight } from 'lucide-react';

export default function BizdevSOP() {
  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">BIZDEV — Standard Operating Procedure</h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end workflow for lead intake, enrichment, D365 sync, and campaign activation.
          </p>
        </div>

        {/* Folder Setup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen size={16} className="text-primary" /> Folder Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">/BIZDEV/intake/apollo</Badge>
                <span className="text-muted-foreground">— Apollo CSV/XLSX exports go here</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">/BIZDEV/intake/zoominfo</Badge>
                <span className="text-muted-foreground">— ZoomInfo attachments auto-saved from Outlook</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">/BIZDEV/sync/d365</Badge>
                <span className="text-muted-foreground">— D365 success files for re-import</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outlook Rule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail size={16} className="text-primary" /> Step 1: Outlook Rule Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <p className="text-muted-foreground">
              Create an Outlook rule to automatically save ZoomInfo exports to your OneDrive/SharePoint folder.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-foreground">
              <li>Open <strong>Outlook → Rules → New Rule</strong></li>
              <li>Condition: <strong>"From" contains "zoominfo"</strong> AND <strong>"Has attachment"</strong></li>
              <li>Action: <strong>Save attachment to</strong> <code className="bg-muted px-1 rounded text-xs">/BIZDEV/intake/zoominfo/</code></li>
              <li>Enable the rule and test with a sample ZoomInfo export email</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Note: When you're ready to merge, upload the ZoomInfo file manually via the Import dialog in BIZDEV.
            </p>
          </CardContent>
        </Card>

        {/* Intake Flow */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload size={16} className="text-primary" /> Step 2: Intake Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Badge>Apollo CSV</Badge>
              <ArrowRight size={12} />
              <Badge variant="secondary">Tag Triggers</Badge>
              <ArrowRight size={12} />
              <Badge variant="secondary">ZoomInfo CSV</Badge>
              <ArrowRight size={12} />
              <Badge variant="outline">Merge & Import</Badge>
            </div>
            <ol className="list-decimal list-inside space-y-2">
              <li>Upload your Apollo export via <strong>Lead Queue → Import Contacts</strong></li>
              <li>Map columns, then <strong>tag manual triggers</strong> (the filters you used in Sales Nav / Apollo)</li>
              <li>Optionally upload the matching ZoomInfo file to enrich phone/company data</li>
              <li>Review the merged preview and click Import</li>
            </ol>
          </CardContent>
        </Card>

        {/* D365 Export & Re-import */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download size={16} className="text-primary" /> Step 3: D365 Export & Success Re-Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>From the Lead Queue, click <strong>Export to D365</strong> to download the Excel workbook</li>
              <li>Open D365 → Data Management → Import → upload the workbook</li>
              <li>After D365 processes the import, download the <strong>success file</strong></li>
              <li>Back in BIZDEV, click <strong>Import D365 Results</strong> and upload the success file</li>
              <li>Matched records become <strong>Claimed</strong>; unmatched go to <strong>Needs Review</strong></li>
            </ol>
          </CardContent>
        </Card>

        {/* Needs Review */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary" /> Step 4: Needs Review & Campaign Activation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>Check the <strong>Needs Review</strong> tab for unmatched records</li>
              <li>Use <strong>Find in D365</strong> to search for duplicates, then paste the D365 URL to link them</li>
              <li>Once resolved, <strong>Claim</strong> or <strong>Reject</strong> each record</li>
              <li>From the Claimed view, multi-select leads and <strong>Bulk Add to Campaign</strong></li>
              <li>Trigger profiles and batch IDs are preserved in the campaign membership snapshot</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
