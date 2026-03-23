import { useState } from 'react';
import {
  useModelMappings,
  useAddModelMapping,
  useDeleteModelMapping,
  useProviders,
} from '@/api/providers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function ModelsPage() {
  const { data: mappingsData, isLoading } = useModelMappings();
  const { data: providersData } = useProviders();
  const addMapping = useAddModelMapping();
  const deleteMapping = useDeleteModelMapping();
  const { toast } = useToast();

  const [newAnthropic, setNewAnthropic] = useState('');
  const [newProviderId, setNewProviderId] = useState('');
  const [newProviderModel, setNewProviderModel] = useState('');

  const mappings = mappingsData?.mappings ?? [];
  const providers = providersData?.providers ?? [];

  const handleAdd = async () => {
    if (!newAnthropic || !newProviderId || !newProviderModel) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    try {
      await addMapping.mutateAsync({ 
        anthropicModel: newAnthropic, 
        providerId: newProviderId,
        providerModel: newProviderModel,
      });
      setNewAnthropic('');
      setNewProviderId('');
      setNewProviderModel('');
      toast({ title: 'Mapping added', variant: 'default' });
    } catch {
      toast({ title: 'Failed to add mapping', variant: 'destructive' });
    }
  };

  const handleDelete = async (anthropicModel: string) => {
    try {
      await deleteMapping.mutateAsync(anthropicModel);
      toast({ title: 'Mapping deleted', variant: 'default' });
    } catch {
      toast({ title: 'Failed to delete mapping', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Model Mappings</h2>
        <p className="text-muted-foreground">
          Map Anthropic models to provider models
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Mapping</CardTitle>
          <CardDescription>
            Create a mapping from an Anthropic model to a provider model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Anthropic Model</label>
              <Input
                value={newAnthropic}
                onChange={(e) => setNewAnthropic(e.target.value)}
                placeholder="e.g., claude-3-5-sonnet-20240620"
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newProviderId}
                onChange={(e) => setNewProviderId(e.target.value)}
              >
                <option value="">Select provider</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} ({p.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Provider Model</label>
              <Input
                value={newProviderModel}
                onChange={(e) => setNewProviderModel(e.target.value)}
                placeholder="e.g., meta/llama-3.1-70b-instruct"
              />
            </div>
            <Button onClick={handleAdd} disabled={addMapping.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Mappings</CardTitle>
          <CardDescription>
            {mappings.length} mapping(s) configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anthropic Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Provider Model</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.anthropicModel}>
                  <TableCell className="font-mono">{mapping.anthropicModel}</TableCell>
                  <TableCell>{mapping.providerId}</TableCell>
                  <TableCell className="font-mono">{mapping.providerModel}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(mapping.anthropicModel)}
                      disabled={deleteMapping.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {mappings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No mappings configured
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
