import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Settings, Activity, Clock, DollarSign, Gauge, ArrowRightLeft } from 'lucide-react';

type RoutingStrategy =
  | 'simple-shuffle'
  | 'failover'
  | 'least-busy'
  | 'latency-based'
  | 'cost-based';

interface DeploymentStatus {
  id: string;
  providerId: string;
  model: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'cooldown';
  inFlightRequests: number;
  cooldownRemaining?: number;
  lastRequest?: string;
}

const strategyDescriptions: Record<RoutingStrategy, string> = {
  'simple-shuffle': 'Weighted random selection across healthy deployments',
  failover: 'Priority-based failover - tries deployments in order',
  'least-busy': 'Selects deployment with fewest in-flight requests',
  'latency-based': 'Selects deployment with lowest average latency',
  'cost-based': 'Selects deployment with lowest input cost',
};

export default function RoutingPage() {
  const { toast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState<RoutingStrategy>('simple-shuffle');
  const [cooldownTime, setCooldownTime] = useState(30);
  const [allowedFails, setAllowedFails] = useState(3);
  const [isSaving, setIsSaving] = useState(false);

  // Mock deployment status - in real implementation this would come from API
  const deploymentStatuses: DeploymentStatus[] = [
    {
      id: '1',
      providerId: 'openai-primary',
      model: 'gpt-4',
      status: 'healthy',
      inFlightRequests: 5,
    },
    {
      id: '2',
      providerId: 'openai-fallback',
      model: 'gpt-4',
      status: 'healthy',
      inFlightRequests: 2,
    },
    {
      id: '3',
      providerId: 'anthropic-primary',
      model: 'claude-3-opus',
      status: 'degraded',
      inFlightRequests: 1,
    },
    {
      id: '4',
      providerId: 'anthropic-fallback',
      model: 'claude-3-sonnet',
      status: 'cooldown',
      inFlightRequests: 0,
      cooldownRemaining: 15,
    },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // In real implementation, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast({
        title: 'Routing configuration saved',
        description: `Strategy: ${selectedStrategy}, Cooldown: ${cooldownTime}s, Allowed Fails: ${allowedFails}`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save routing configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: DeploymentStatus['status']) => {
    const variants: Record<
      DeploymentStatus['status'],
      'success' | 'secondary' | 'destructive' | 'outline'
    > = {
      healthy: 'success',
      degraded: 'secondary',
      unhealthy: 'destructive',
      cooldown: 'outline',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getStrategyIcon = (strategy: RoutingStrategy) => {
    switch (strategy) {
      case 'simple-shuffle':
        return <ArrowRightLeft className="h-5 w-5" />;
      case 'failover':
        return <Activity className="h-5 w-5" />;
      case 'least-busy':
        return <Gauge className="h-5 w-5" />;
      case 'latency-based':
        return <Clock className="h-5 w-5" />;
      case 'cost-based':
        return <DollarSign className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Routing Configuration</h2>
          <p className="text-muted-foreground">
            Configure how requests are routed across deployments
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Settings className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Routing Strategy</CardTitle>
            <CardDescription>
              Choose how requests are distributed across deployments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedStrategy}
              onValueChange={(value) => setSelectedStrategy(value as RoutingStrategy)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple-shuffle">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    Simple Shuffle (Default)
                  </div>
                </SelectItem>
                <SelectItem value="failover">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Failover
                  </div>
                </SelectItem>
                <SelectItem value="least-busy">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Least Busy
                  </div>
                </SelectItem>
                <SelectItem value="latency-based">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Latency Based
                  </div>
                </SelectItem>
                <SelectItem value="cost-based">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Cost Based
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              {getStrategyIcon(selectedStrategy)}
              <p className="text-sm text-muted-foreground">
                {strategyDescriptions[selectedStrategy]}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cooldown Settings</CardTitle>
            <CardDescription>Configure when deployments are temporarily disabled</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Allowed Failures</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowedFails}
                  onChange={(e) => setAllowedFails(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 border rounded-md"
                  min={1}
                  max={10}
                />
                <span className="text-sm text-muted-foreground">
                  consecutive failures before cooldown
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cooldown Time</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={cooldownTime}
                  onChange={(e) => setCooldownTime(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 border rounded-md"
                  min={5}
                  max={300}
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployment Status</CardTitle>
          <CardDescription>Current health and load status of all deployments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deploymentStatuses.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{deployment.providerId}</p>
                    <p className="text-sm text-muted-foreground">{deployment.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">In-flight</p>
                    <p className="font-medium">{deployment.inFlightRequests}</p>
                  </div>
                  {deployment.cooldownRemaining !== undefined && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Cooldown</p>
                      <p className="font-medium text-yellow-600">{deployment.cooldownRemaining}s</p>
                    </div>
                  )}
                  {getStatusBadge(deployment.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strategy Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(
              [
                'simple-shuffle',
                'failover',
                'least-busy',
                'latency-based',
                'cost-based',
              ] as RoutingStrategy[]
            ).map((strategy) => (
              <div
                key={strategy}
                className={`p-4 border rounded-lg ${selectedStrategy === strategy ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getStrategyIcon(strategy)}
                  <h4 className="font-medium capitalize">{strategy.replace('-', ' ')}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{strategyDescriptions[strategy]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
