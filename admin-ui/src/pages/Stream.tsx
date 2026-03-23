import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRequestLogs } from '@/api/logs';
import { Activity, Wifi, WifiOff, Play, Pause } from 'lucide-react';

interface StreamEvent {
  type: string;
  timestamp: string;
  data: unknown;
}

export default function StreamPage() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { data: logs } = useRequestLogs({ limit: 20 });

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleConnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/admin/stream/logs');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [
          {
            type: 'logs',
            timestamp: new Date().toISOString(),
            data,
          },
          ...prev.slice(0, 49),
        ]);
      } catch {}
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
    };
  };

  const handleDisconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Streaming Monitor</h2>
        <p className="text-muted-foreground">
          Monitor real-time request streams and events
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Connection Status
              {connected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connected ? (
              <div className="flex items-center gap-4">
                <Badge variant="success">Connected</Badge>
                <Button variant="outline" onClick={handleDisconnect}>
                  <Pause className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={handleConnect}>
                <Play className="h-4 w-4 mr-2" />
                Connect to Stream
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs?.logs.length ?? 0}</div>
            <p className="text-sm text-muted-foreground">Active requests in buffer</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {connected ? 'Waiting for events...' : 'Connect to see live events'}
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event, i) => (
                <div key={i} className="flex items-start gap-4 p-2 bg-muted rounded">
                  <Badge variant="outline" className="shrink-0">
                    {event.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <pre className="text-xs font-mono overflow-x-auto">
                    {JSON.stringify(event.data, null, 2).slice(0, 200)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
