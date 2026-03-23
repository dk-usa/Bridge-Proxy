import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTrace, useLogDetail } from '@/api/logs';
import { useDebugTranslate, useReplayRequest } from '@/api/debug';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Play, RefreshCw, ArrowRight } from 'lucide-react';

const sampleRequest = {
  model: 'claude-3-5-sonnet-20240620',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  max_tokens: 1024,
};

export default function DebugPage() {
  const { id } = useParams();
  const { toast } = useToast();
  
  const { data: traceData } = useTrace(id ?? '');
  useLogDetail(id ?? '');
  const translateMutation = useDebugTranslate();
  const replayMutation = useReplayRequest();

  const [requestJson, setRequestJson] = useState(JSON.stringify(sampleRequest, null, 2));
  const [translateResult, setTranslateResult] = useState<unknown>(null);

  const trace = traceData?.trace;

  const handleTranslate = async () => {
    try {
      const parsed = JSON.parse(requestJson);
      const result = await translateMutation.mutateAsync(parsed);
      setTranslateResult(result);
      toast({ title: 'Translation complete', variant: 'default' });
    } catch (err) {
      toast({ title: 'Invalid JSON or translation error', variant: 'destructive' });
    }
  };

  const handleReplay = async (provider: 'primary' | 'fallback') => {
    if (!id) return;
    try {
      await replayMutation.mutateAsync({ id, provider });
      toast({ title: 'Replay complete', variant: 'default' });
    } catch {
      toast({ title: 'Replay failed', variant: 'destructive' });
    }
  };

  const renderJson = (data: unknown) => (
    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
      {JSON.stringify(data, null, 2)}
    </pre>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Debugger</h2>
        <p className="text-muted-foreground">
          Debug request translation and replay requests
        </p>
      </div>

      {id ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Request {id.slice(0, 12)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button onClick={() => handleReplay('primary')} disabled={replayMutation.isPending}>
                    <Play className="h-4 w-4 mr-2" />
                    Replay Primary
                  </Button>
                  <Button variant="outline" onClick={() => handleReplay('fallback')} disabled={replayMutation.isPending}>
                    <Play className="h-4 w-4 mr-2" />
                    Replay Fallback
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {trace && (
            <Tabs defaultValue="trace">
              <TabsList>
                <TabsTrigger value="trace">Full Trace</TabsTrigger>
                <TabsTrigger value="anthropic">Anthropic Request</TabsTrigger>
                <TabsTrigger value="openai">OpenAI Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>

              <TabsContent value="trace">
                <Card>
                  <CardHeader>
                    <CardTitle>Request Trace</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{trace.method}</Badge>
                      <Badge variant="outline">{trace.url}</Badge>
                      <Badge variant={trace.status === 'success' ? 'success' : 'destructive'}>
                        {trace.status}
                      </Badge>
                      <Badge variant="outline">{trace.latency_ms}ms</Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {trace.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Badge>{step.name}</Badge>
                          {i < trace.steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      ))}
                    </div>

                    {trace.error && (
                      <div className="bg-destructive/10 p-4 rounded-lg text-destructive">
                        {trace.error}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="anthropic">
                <Card>
                  <CardHeader>
                    <CardTitle>Anthropic Request</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderJson(trace.steps.find(s => s.name === 'Anthropic Request')?.data ?? null)}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="openai">
                <Card>
                  <CardHeader>
                    <CardTitle>OpenAI Request</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderJson(trace.steps.find(s => s.name === 'OpenAI Request')?.data ?? null)}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="response">
                <Card>
                  <CardHeader>
                    <CardTitle>Provider Response</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderJson(trace.steps.find(s => s.name === 'Provider Response')?.data ?? 
                                 trace.steps.find(s => s.name === 'Anthropic Response')?.data ?? null)}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Anthropic Request</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full h-64 bg-muted p-4 rounded-lg font-mono text-xs resize-none"
                value={requestJson}
                onChange={(e) => setRequestJson(e.target.value)}
              />
              <Button onClick={handleTranslate} className="mt-4" disabled={translateMutation.isPending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${translateMutation.isPending ? 'animate-spin' : ''}`} />
                Translate
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Translation Result</CardTitle>
            </CardHeader>
            <CardContent>
              {translateResult ? (
                <Tabs defaultValue="normalized">
                  <TabsList>
                    <TabsTrigger value="normalized">Normalized</TabsTrigger>
                    <TabsTrigger value="openai">OpenAI</TabsTrigger>
                  </TabsList>
                  <TabsContent value="normalized">
                    {renderJson((translateResult as { normalized_request?: unknown }).normalized_request)}
                  </TabsContent>
                  <TabsContent value="openai">
                    {renderJson((translateResult as { openai_request?: unknown }).openai_request)}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-muted-foreground text-center py-10">
                  Enter an Anthropic request and click Translate
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
