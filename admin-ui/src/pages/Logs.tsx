import { useState, useRef, useEffect } from 'react';
import { useRequestLogs, useClearLogs, useLogStream, type RequestLog } from '@/api/logs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Circle,
  ArrowDown,
  Loader2,
} from 'lucide-react';

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function LogStreamEntry({ log, isNew }: { log: RequestLog; isNew: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 text-sm border-b border-border/50 ${
        isNew ? 'animate-in slide-in-from-top duration-300' : ''
      }`}
    >
      <span className="font-mono text-xs text-muted-foreground w-20">
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      <span className="font-medium text-xs w-16">POST</span>
      <span className="flex-1 truncate text-xs">{log.model ?? '-'}</span>
      <span
        className={`text-xs font-medium ${
          log.statusCode >= 500
            ? 'text-red-500'
            : log.statusCode >= 400
              ? 'text-yellow-500'
              : 'text-green-500'
        }`}
      >
        {log.statusCode}
      </span>
      <span className="text-xs text-muted-foreground w-16 text-right">
        {formatLatency(log.latencyMs)}
      </span>
      <Circle
        className={`h-2 w-2 ${log.status === 'success' ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
      />
    </div>
  );
}

function LiveLogPanel({
  logs,
  connected,
  error,
}: {
  logs: RequestLog[];
  connected: boolean;
  error: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
            }`}
          />
          <span className="text-sm font-medium">
            {connected ? 'Live' : error || 'Disconnected'}
          </span>
        </div>
        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className="text-xs"
          >
            {autoScroll ? (
              'Auto-scroll on'
            ) : (
              <>
                <ArrowDown className="h-3 w-3 mr-1" />
                Jump to latest
              </>
            )}
          </Button>
        )}
      </div>
      <div ref={containerRef} className="max-h-[400px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {connected ? 'Waiting for requests...' : 'Connecting to stream...'}
          </div>
        ) : (
          logs.map((log, idx) => <LogStreamEntry key={log.id} log={log} isNew={idx === 0} />)
        )}
      </div>
    </div>
  );
}

export default function LogsPage() {
  const [tab, setTab] = useState('live');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useRequestLogs();
  const { logs: liveLogs, connected, error: streamError } = useLogStream(tab === 'live');
  const clearLogs = useClearLogs();
  const { toast } = useToast();

  const historicalLogs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) return;
    try {
      await clearLogs.mutateAsync();
      toast({ title: 'Logs cleared', variant: 'default' });
    } catch {
      toast({ title: 'Failed to clear logs', variant: 'destructive' });
    }
  };

  if (isLoading && tab === 'historical') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Request Logs</h2>
          <p className="text-muted-foreground">{total} total request(s)</p>
        </div>
        <Button variant="destructive" onClick={handleClear} disabled={clearLogs.isPending}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Logs
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live" className="gap-2">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-muted'}`}
            />
            Live
          </TabsTrigger>
          <TabsTrigger value="historical">Historical</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-4">
          <LiveLogPanel logs={liveLogs} connected={connected} error={streamError} />
        </TabsContent>

        <TabsContent value="historical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by request ID, model..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.id}</TableCell>
                      <TableCell>{log.model ?? '-'}</TableCell>
                      <TableCell>{log.provider ?? '-'}</TableCell>
                      <TableCell>{log.latencyMs}ms</TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="success">Success</Badge>
                        ) : (
                          <Badge variant="destructive">Error</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {historicalLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
