import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, RefreshCw } from 'lucide-react';

export default function Enrichment() {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enrichment</h1>
          <p className="text-sm text-muted-foreground">Import and enrich account & contact data from ZoomInfo, Zywave, and CSV</p>
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
                <p className="text-sm text-muted-foreground mb-3">Drag & drop a CSV or XLSX file</p>
                <Button variant="outline" size="sm">Browse Files</Button>
              </div>
            </CardContent>
          </Card>

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
      </div>
    </Layout>
  );
}
