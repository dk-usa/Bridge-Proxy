import { useState } from 'react';
import { useTeams, type Team, type CreateTeamRequest } from '@/api/teams';
import { useOrganizations } from '@/api/orgs';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

export default function TeamsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { fetchTeams, createTeam, updateTeam, deleteTeam } = useTeams();
  const { fetchOrganizations } = useOrganizations();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState<CreateTeamRequest>({ name: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => fetchTeams(),
  });

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
  });

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsCreateOpen(false);
      setFormData({ name: '' });
      toast({ title: 'Team created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create team', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTeamRequest> }) =>
      updateTeam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditingTeam(null);
      toast({ title: 'Team updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update team', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Team deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete team', variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description,
      organizationId: team.organizationId,
    });
    setIsCreateOpen(true);
  };

  const teams = data?.teams ?? [];
  const organizations = orgsData?.organizations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teams</h2>
          <p className="text-muted-foreground">Manage your teams</p>
        </div>
        <Button
          onClick={() => {
            setIsCreateOpen(true);
            setEditingTeam(null);
            setFormData({ name: '' });
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Team
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10">Loading...</div>
          ) : teams.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No teams found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Spend</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => {
                  const org = organizations.find((o) => o.id === team.organizationId);
                  return (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{org?.name ?? '-'}</TableCell>
                      <TableCell>${team.budget?.toFixed(2) ?? 'Unlimited'}</TableCell>
                      <TableCell>${team.spend?.toFixed(6) ?? '0.00'}</TableCell>
                      <TableCell>{team.requestCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={team.enabled ? 'success' : 'destructive'}>
                          {team.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(team)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(team.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Edit Team' : 'Create Team'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Team name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Organization</label>
              <Select
                value={formData.organizationId}
                onValueChange={(v) => setFormData({ ...formData, organizationId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Budget ($)</label>
              <Input
                type="number"
                value={formData.budget ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    budget: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="Optional budget limit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingTeam ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
