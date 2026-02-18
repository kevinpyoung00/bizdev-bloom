import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Mail, Upload, Download, CheckCircle2, ArrowRight, Search, Users } from 'lucide-react';

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
              <li>Upload your Apollo export via <strong>Lead Queue → Multi-Source Import</strong></li>
              <li>Map columns, then <strong>tag manual triggers</strong> (the filters you used in Sales Nav / Apollo)</li>
              <li>Optionally upload the matching ZoomInfo file to enrich phone/company data</li>
              <li>Review the merged preview and click Import</li>
            </ol>
            <div className="mt-3 p-3 bg-muted/50 rounded text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">ZoomInfo File Format</p>
              <p>Expected columns: <code>firstName, lastName, email, directPhone, title, company, website, employeeCount, city, state, linkedinUrl</code></p>
              <p className="mt-1">The importer auto-detects ZoomInfo files by filename and maps headers accordingly.</p>
            </div>
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
              <li>From the Lead Queue, claim leads you want to push to D365</li>
              <li>Click <strong>Export D365 Workbook</strong> to download a dual-sheet Excel file (Accounts + Contacts)</li>
              <li>Open D365 → Data Management → Import → upload the workbook</li>
              <li>After D365 processes the import, download the <strong>success file</strong></li>
              <li>Back in BIZDEV, click <strong>Import D365 Success</strong> and upload the success file</li>
              <li>The system matches by email, extracts CRM GUIDs from Record URLs, and stamps contacts</li>
              <li>Matched records become <strong>Claimed</strong>; unmatched go to <strong>Needs Review</strong></li>
            </ol>
            <div className="mt-3 p-3 bg-muted/50 rounded text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">D365 Workbook Sheets</p>
              <p><strong>Accounts:</strong> Account Name, Website, Address City, Address State/Region, Number of Employees, Industry</p>
              <p><strong>Contacts:</strong> First Name, Last Name, Parent Customer, Email, Business Phone, Job Title, Address City, Address State/Region</p>
              <p className="mt-1"><strong>Success file:</strong> Must contain <code>Email</code> and <code>Record URL</code> columns. The GUID is extracted from the URL automatically.</p>
            </div>
          </CardContent>
        </Card>

        {/* Needs Review */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search size={16} className="text-primary" /> Step 4: Needs Review & D365 Resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>After D365 success re-import, unmatched contacts appear in <strong>Needs Review</strong></li>
              <li>Click <strong>Find in D365</strong> to search D365 by email or name</li>
              <li>If you find the record in D365, click <strong>Paste URL</strong> and paste the D365 record URL</li>
              <li>The system extracts and stores the CRM GUID, replacing "Find in D365" with <strong>Open in D365</strong></li>
              <li><strong>Claim</strong> or <strong>Reject</strong> each resolved contact</li>
            </ol>
          </CardContent>
        </Card>

        {/* Campaign Activation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={16} className="text-primary" /> Step 5: Campaign Activation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>From the Lead Queue, filter to <strong>Claimed</strong> leads</li>
              <li>Multi-select leads using checkboxes</li>
              <li>Click <strong>Add to Campaign</strong> in the bulk action toolbar</li>
              <li>Select a 12-week drip campaign from the dropdown</li>
              <li>Trigger profiles and batch IDs are <strong>snapshotted</strong> into the membership record</li>
              <li>The contact's own trigger_profile is never mutated — the snapshot preserves context for personalization</li>
            </ol>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ⚡ Feature Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Features are gated behind flags for staged rollout:</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">bizdev_triggers</Badge>
                <span className="text-xs">Trigger tagging on intake</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">bizdev_merge</Badge>
                <span className="text-xs">ZoomInfo merge pipeline</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">bizdev_d365_export</Badge>
                <span className="text-xs">D365 workbook + success re-import</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">bizdev_review</Badge>
                <span className="text-xs">D365 deep links in Needs Review</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">bizdev_campaign_bulk</Badge>
                <span className="text-xs">Bulk add to campaign</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
