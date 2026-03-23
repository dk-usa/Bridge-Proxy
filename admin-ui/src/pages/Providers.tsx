import { useState } from 'react';
import { useProviders, useUpdateProvider, useTestProvider, useAddProvider, useDeleteProvider } from '@/api/providers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Save, Plus, Trash2 } from 'lucide-react';

interface ProviderFormData {
  id: string;
  type: 'openai-compatible' | 'anthropic-compatible';
  apiKey: string;
  baseUrl: string;
  models: string;
  timeoutMs: string;
  enabled: boolean;
  priority: string;
}

const defaultProvider: ProviderFormData = {
  id: '',
  type: 'openai-compatible',
  apiKey: '',
  baseUrl: '',
  models: '',
  timeoutMs: '60000',
  enabled: true,
  priority: '10',
};

export default function ProvidersPage() {
  const { data, isLoading } = useProviders();
  const updateProvider = useUpdateProvider();
  const addProvider = useAddProvider();
  const deleteProvider = useDeleteProvider();
  const testProvider = useTestProvider();
  const { toast } = useToast();

  const [forms, setForms] = useState<Record<string, ProviderFormData>>({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newProvider, setNewProvider] = useState<ProviderFormData>(defaultProvider);

  const providers = data?.providers ?? [];

  const getFormData = (provider: typeof providers[0]): ProviderFormData => {
    if (forms[provider.id]) return forms[provider.id];
    return {
      id: provider.id,
      type: provider.type,
      apiKey: provider.apiKey ? provider.apiKey.replace(/^\*\*\*/, '').replace(/....$/, '****') : '',
      baseUrl: provider.baseUrl,
      models: provider.models?.join(', ') ?? '',
      timeoutMs: provider.timeoutMs?.toString() ?? '60000',
      enabled: provider.enabled,
      priority: provider.priority?.toString() ?? '10',
    };
  };

  const updateForm = (id: string, field: keyof ProviderFormData, value: string | boolean) => {
    setForms((prev) => ({
      ...prev,
      [id]: { ...getFormData(providers.find((p) => p.id === id)!), [field]: value },
    }));
  };

  const handleSave = async (id: string) => {
    const form = getFormData(providers.find((p) => p.id === id)!);
    try {
      await updateProvider.mutateAsync({
        id,
        data: {
          apiKey: form.apiKey || undefined,
          baseUrl: form.baseUrl,
          models: form.models.split(',').map(m => m.trim()).filter(Boolean),
          timeoutMs: parseInt(form.timeoutMs),
          enabled: form.enabled,
          priority: parseInt(form.priority),
        },
      });
      toast({ title: 'Provider updated', variant: 'default' });
    } catch {
      toast({ title: 'Failed to update provider', variant: 'destructive' });
    }
  };

  const handleAdd = async () => {
    if (!newProvider.id || !newProvider.baseUrl) {
      toast({ title: 'ID and Base URL are required', variant: 'destructive' });
      return;
    }
    try {
      await addProvider.mutateAsync({
        id: newProvider.id,
        type: newProvider.type,
        apiKey: newProvider.apiKey || undefined,
        baseUrl: newProvider.baseUrl,
        models: newProvider.models.split(',').map(m => m.trim()).filter(Boolean),
        timeoutMs: parseInt(newProvider.timeoutMs),
        enabled: newProvider.enabled,
        priority: parseInt(newProvider.priority),
      });
      setNewProvider(defaultProvider);
      setShowNewForm(false);
      toast({ title: 'Provider added', variant: 'default' });
    } catch {
      toast({ title: 'Failed to add provider', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete provider ${id}?`)) return;
    try {
      await deleteProvider.mutateAsync(id);
      toast({ title: 'Provider deleted', variant: 'default' });
    } catch {
      toast({ title: 'Failed to delete provider', variant: 'destructive' });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testProvider.mutateAsync(id);
      toast({
        title: result.success ? 'Provider healthy' : 'Provider error',
        description: result.success ? `Latency: ${result.latencyMs}ms` : result.error,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch {
      toast({ title: 'Test failed', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="warning">Degraded</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Providers</h2>
          <p className="text-muted-foreground">Configure and monitor your API providers</p>
        </div>
        <Button onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider ID</label>
                <Input
                  value={newProvider.id}
                  onChange={(e) => setNewProvider({ ...newProvider, id: e.target.value })}
                  placeholder="e.g., nim, ollama, vllm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newProvider.type}
                  onChange={(e) => setNewProvider({ ...newProvider, type: e.target.value as 'openai-compatible' | 'anthropic-compatible' })}
                >
                  <option value="openai-compatible">OpenAI Compatible</option>
                  <option value="anthropic-compatible">Anthropic Compatible</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Base URL</label>
                <Input
                  value={newProvider.baseUrl}
                  onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Models (comma-separated)</label>
                <Input
                  value={newProvider.models}
                  onChange={(e) => setNewProvider({ ...newProvider, models: e.target.value })}
                  placeholder="e.g., gpt-4o, gpt-4o-mini"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Timeout (ms)</label>
                <Input
                  type="number"
                  value={newProvider.timeoutMs}
                  onChange={(e) => setNewProvider({ ...newProvider, timeoutMs: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleAdd} disabled={addProvider.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Add Provider
                </Button>
                <Button variant="outline" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {providers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No providers configured. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {provider.id}
                      {getStatusBadge(provider.status)}
                    </CardTitle>
                    <CardDescription>
                      Type: {provider.type} • Priority: {provider.priority ?? 0}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleTest(provider.id)} disabled={testProvider.isPending}>
                      <RefreshCw className={`h-4 w-4 ${testProvider.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(provider.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">API Key</label>
                    <Input
                      type="password"
                      value={getFormData(provider).apiKey}
                      onChange={(e) => updateForm(provider.id, 'apiKey', e.target.value)}
                      placeholder="Enter API key"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Base URL</label>
                    <Input
                      value={getFormData(provider).baseUrl}
                      onChange={(e) => updateForm(provider.id, 'baseUrl', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Models</label>
                    <Input
                      value={getFormData(provider).models}
                      onChange={(e) => updateForm(provider.id, 'models', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timeout (ms)</label>
                    <Input
                      type="number"
                      value={getFormData(provider).timeoutMs}
                      onChange={(e) => updateForm(provider.id, 'timeoutMs', e.target.value)}
                    />
                  </div>
                  <div className="flex items-end col-span-2">
                    <Button onClick={() => handleSave(provider.id)} disabled={updateProvider.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
