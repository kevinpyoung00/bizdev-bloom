import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, Save } from 'lucide-react';
import {
  useIntegrationSettings,
  useToggleIntegration,
  useSetApiKey,
  type IntegrationSetting,
} from '@/hooks/useIntegrationSettings';

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  zoominfo: 'Company firmographics, contacts, emails, phones, org charts',
  clearbit: 'Firmographic enrichment and tech stack detection',
  apollo: 'Person-level email/phone enrichment via LinkedIn URL',
  crunchbase: 'Funding rounds, investors, and company news',
  news_api: 'Recent press mentions and PR snippets',
  zywave: 'Carrier mapping and renewal date tracking',
};

const NO_KEY_PROVIDERS = new Set(['zywave']);

function IntegrationRow({ setting }: { setting: IntegrationSetting }) {
  const toggleMutation = useToggleIntegration();
  const setKeyMutation = useSetApiKey();
  const [localKey, setLocalKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const needsKey = !NO_KEY_PROVIDERS.has(setting.provider);
  const isConnected = setting.enabled && (!needsKey || !!setting.api_key_ref);

  const handleSaveKey = () => {
    if (!localKey.trim()) return;
    setKeyMutation.mutate(
      { provider: setting.provider, api_key_ref: localKey.trim() },
      { onSuccess: () => setLocalKey('') }
    );
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={setting.enabled}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ provider: setting.provider, enabled: checked })
            }
            disabled={toggleMutation.isPending}
          />
          <div>
            <span className="text-sm font-medium text-foreground">{setting.display_name}</span>
            <p className="text-xs text-muted-foreground">
              {PROVIDER_DESCRIPTIONS[setting.provider] || 'Data enrichment provider'}
            </p>
          </div>
        </div>
        {isConnected ? (
          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 dark:text-green-400">
            Connected
          </Badge>
        ) : setting.enabled ? (
          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
            Needs Key
          </Badge>
        ) : null}
      </div>

      {setting.enabled && needsKey && (
        <div className="flex gap-2 pl-10">
          <div className="relative flex-1">
            <Input
              type={showKey ? 'text' : 'password'}
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder={setting.api_key_ref ? '••••••••  (key saved)' : 'Paste API key…'}
              className="text-sm pr-8"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveKey}
            disabled={!localKey.trim() || setKeyMutation.isPending}
          >
            {setKeyMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPanel() {
  const { data: settings, isLoading } = useIntegrationSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Enable data providers for enrichment. Keys are stored securely and used by the enrichment pipeline in priority order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          settings?.map((s) => <IntegrationRow key={s.id} setting={s} />)
        )}
      </CardContent>
    </Card>
  );
}
