import { useState } from 'react';
import { useApiKeys, useCreateApiKey, useDeleteApiKey, useResetKeySpend } from '@/api/keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  Trash2,
  DollarSign,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';

type ExpirationPreset = 'never' | '30days' | '90days' | '1year' | 'custom';

export default function ApiKeysPage() {
  const { data, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const resetSpend = useResetKeySpend();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyBudget, setNewKeyBudget] = useState('');
  const [newKeyRateLimit, setNewKeyRateLimit] = useState('');
  const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>('never');
  const [customDays, setCustomDays] = useState('');

  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const keys = data?.keys ?? [];

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    try {
      let expiresInDays: number | null = null;
      if (expirationPreset === '30days') expiresInDays = 30;
      else if (expirationPreset === '90days') expiresInDays = 90;
      else if (expirationPreset === '1year') expiresInDays = 365;
      else if (expirationPreset === 'custom' && customDays)
        expiresInDays = parseInt(customDays, 10);

      const result = await createKey.mutateAsync({
        name: newKeyName,
        budget: newKeyBudget ? parseFloat(newKeyBudget) : null,
        rateLimit: newKeyRateLimit ? parseInt(newKeyRateLimit, 10) : undefined,
        expiresInDays,
      });

      setCreatedKey(result.data.key);
      setKeyVisible(false);
      setShowCreate(false);
      setNewKeyName('');
      setNewKeyBudget('');
      setNewKeyRateLimit('');
      setExpirationPreset('never');
      setCustomDays('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this key?')) return;
    try {
      await deleteKey.mutateAsync(id);
      toast({ title: 'Key deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete key', variant: 'destructive' });
    }
  };

  const handleResetSpend = async (id: string) => {
    try {
      await resetSpend.mutateAsync(id);
      toast({ title: 'Spend reset' });
    } catch {
      toast({ title: 'Error', description: 'Failed to reset spend', variant: 'destructive' });
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  const getBudgetPercentage = (spend: number, budget: number | null) => {
    if (!budget) return null;
    return Math.min((spend / budget) * 100, 100);
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground">Manage virtual API keys and track spend</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Key
        </Button>
      </div>

      {(showCreate || createdKey) && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle>{createdKey ? 'API Key Created' : 'Create New Key'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!createdKey ? (
              <>
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="My Production Key"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Give this key a descriptive name to identify it later
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Monthly Budget (USD)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newKeyBudget}
                      onChange={(e) => setNewKeyBudget(e.target.value)}
                      placeholder="No limit"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for unlimited budget
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Rate Limit (req/min)</label>
                    <Input
                      type="number"
                      value={newKeyRateLimit}
                      onChange={(e) => setNewKeyRateLimit(e.target.value)}
                      placeholder="No limit"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional. Leave empty for no rate limiting
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Key Expiration</label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {(['never', '30days', '90days', '1year', 'custom'] as ExpirationPreset[]).map(
                      (preset) => (
                        <Button
                          key={preset}
                          variant={expirationPreset === preset ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setExpirationPreset(preset)}
                        >
                          {preset === 'never' && 'Never'}
                          {preset === '30days' && '30 days'}
                          {preset === '90days' && '90 days'}
                          {preset === '1year' && '1 year'}
                          {preset === 'custom' && 'Custom'}
                        </Button>
                      )
                    )}
                  </div>
                  {expirationPreset === 'custom' && (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Number of days"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="w-40"
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Copy this key now. You won't be able to see it again.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-4 py-3 rounded-lg font-mono text-sm">
                    {keyVisible
                      ? createdKey
                      : `${createdKey.slice(0, 20)}...${createdKey.slice(-8)}`}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setKeyVisible(!keyVisible)}
                    title={keyVisible ? 'Hide' : 'Show'}
                  >
                    {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyKey(createdKey)}
                    title="Copy"
                  >
                    {copiedKey ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {createdKey ? (
                <Button
                  onClick={() => {
                    setCreatedKey(null);
                    setShowCreate(false);
                  }}
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button onClick={handleCreate} disabled={createKey.isPending}>
                    {createKey.isPending ? 'Creating...' : 'Create Key'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false);
                      setCreatedKey(null);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keys.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(keys.reduce((sum, k) => sum + k.spend, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {keys.reduce((sum, k) => sum + k.requestCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Spend</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => {
                const budgetPercent = getBudgetPercentage(key.spend, key.budget);
                const expired = isExpired(key.expiresAt);
                return (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {key.key.slice(0, 12)}...
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => copyKey(key.key)}>
                          {copiedKey ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.budget ? formatCurrency(key.budget) : '-'}
                      {budgetPercent !== null && (
                        <div className="w-24 h-1 bg-muted rounded-full mt-1">
                          <div
                            className={`h-1 rounded-full ${
                              budgetPercent > 90
                                ? 'bg-red-500'
                                : budgetPercent > 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${budgetPercent}%` }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(key.spend)}</TableCell>
                    <TableCell>
                      <span className={expired ? 'text-red-500' : ''}>
                        {formatDate(key.expiresAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : key.enabled ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetSpend(key.id)}
                          title="Reset Spend"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(key.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No API keys yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
