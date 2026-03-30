import { useState } from 'react';
import {
  useVirtualKeys,
  useCreateVirtualKey,
  useDeleteVirtualKey,
  useRotateVirtualKey,
  useResetVirtualKeySpend,
} from '@/api/virtual-keys';
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
  Key,
  ArrowRightLeft,
} from 'lucide-react';

type BudgetDuration = '30d' | '1m';

export default function VirtualKeysPage() {
  const { data, isLoading } = useVirtualKeys();
  const createKey = useCreateVirtualKey();
  const deleteKey = useDeleteVirtualKey();
  const rotateKey = useRotateVirtualKey();
  const resetSpend = useResetVirtualKeySpend();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyBudget, setNewKeyBudget] = useState('');
  const [newKeyModels, setNewKeyModels] = useState('');
  const [budgetDuration, setBudgetDuration] = useState<BudgetDuration>('30d');

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
      const result = await createKey.mutateAsync({
        name: newKeyName,
        maxBudget: newKeyBudget ? parseFloat(newKeyBudget) : undefined,
        models: newKeyModels ? newKeyModels.split(',').map((m) => m.trim()) : undefined,
        budgetDuration,
      });

      setCreatedKey(result.key.key);
      setKeyVisible(false);
      setShowCreate(false);
      setNewKeyName('');
      setNewKeyBudget('');
      setNewKeyModels('');
      setBudgetDuration('30d');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create virtual key',
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

  const handleRotate = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to rotate this key? The old key will remain valid during grace period.'
      )
    )
      return;
    try {
      const result = await rotateKey.mutateAsync(id);
      toast({
        title: 'Key rotated',
        description: `New key created: ${result.newKey.key.slice(0, 12)}...`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to rotate key', variant: 'destructive' });
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

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  const getBudgetPercentage = (spend: number, budget: number | undefined) => {
    if (!budget) return null;
    return Math.min((spend / budget) * 100, 100);
  };

  const isExpired = (expiresAt: string | undefined) => {
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
          <h2 className="text-3xl font-bold tracking-tight">Virtual Keys</h2>
          <p className="text-muted-foreground">Manage virtual API keys with budget tracking</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Key
        </Button>
      </div>

      {(showCreate || createdKey) && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle>{createdKey ? 'Virtual Key Created' : 'Create New Key'}</CardTitle>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Max Budget (USD)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newKeyBudget}
                      onChange={(e) => setNewKeyBudget(e.target.value)}
                      placeholder="No limit"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Budget Duration</label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant={budgetDuration === '30d' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setBudgetDuration('30d')}
                      >
                        30 days
                      </Button>
                      <Button
                        variant={budgetDuration === '1m' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setBudgetDuration('1m')}
                      >
                        Monthly
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Allowed Models (comma-separated)</label>
                  <Input
                    value={newKeyModels}
                    onChange={(e) => setNewKeyModels(e.target.value)}
                    placeholder="gpt-4, claude-3-opus (leave empty for all)"
                    className="mt-1"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Copy this key now. You won&apos;t be able to see it again.
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
            <Key className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {keys.filter((k) => k.enabled && !isExpired(k.expiresAt)).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Virtual Keys</CardTitle>
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
                const budgetPercent = getBudgetPercentage(key.spend, key.maxBudget);
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
                      {key.maxBudget ? formatCurrency(key.maxBudget) : '-'}
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
                          onClick={() => handleRotate(key.id)}
                          title="Rotate Key"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
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
                    No virtual keys yet
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
