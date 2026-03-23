import { z } from 'zod';

export const RequestLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  method: z.string(),
  url: z.string(),
  statusCode: z.number(),
  model: z.string().optional(),
  provider: z.string().optional(),
  latencyMs: z.number(),
  status: z.enum(['success', 'error']),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  inputCost: z.number().optional(),
  outputCost: z.number().optional(),
  totalCost: z.number().optional(),
  anthropicRequest: z.unknown().optional(),
  normalizedRequest: z.unknown().optional(),
  openaiRequest: z.unknown().optional(),
  providerResponse: z.unknown().optional(),
  anthropicResponse: z.unknown().optional(),
  error: z.string().optional(),
});

export type RequestLog = z.infer<typeof RequestLogSchema>;

class RingBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      result.push(this.buffer[idx] as T);
    }
    return result;
  }

  getLast(n: number): T[] {
    const result: T[] = [];
    const take = Math.min(n, this.count);
    for (let i = 0; i < take; i++) {
      const idx = (this.tail - 1 - i + this.capacity) % this.capacity;
      result.unshift(this.buffer[idx] as T);
    }
    return result;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item && predicate(item as T)) {
        return item as T;
      }
    }
    return undefined;
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.toArray().filter(predicate);
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.buffer = new Array(this.capacity);
  }

  get size(): number {
    return this.count;
  }
}

class RequestLogger {
  private logBuffer: RingBuffer<RequestLog>;

  constructor(bufferSize: number = 1000) {
    this.logBuffer = new RingBuffer<RequestLog>(bufferSize);
  }

  setBufferSize(size: number): void {
    const currentLogs = this.logBuffer.toArray();
    this.logBuffer = new RingBuffer<RequestLog>(size);
    for (const log of currentLogs) {
      this.logBuffer.push(log);
    }
  }

  addLog(log: RequestLog): void {
    this.logBuffer.push(log);
  }

  getLogs(options?: {
    limit?: number;
    offset?: number;
    status?: 'success' | 'error';
    provider?: string;
    model?: string;
    search?: string;
  }): { logs: RequestLog[]; total: number } {
    let logs = this.logBuffer.toArray();

    if (options?.status) {
      logs = logs.filter((l) => l.status === options.status);
    }
    if (options?.provider) {
      logs = logs.filter((l) => l.provider === options.provider);
    }
    if (options?.model) {
      logs = logs.filter((l) => l.model === options.model);
    }
    if (options?.search) {
      const search = options.search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.id.toLowerCase().includes(search) ||
          l.url.toLowerCase().includes(search) ||
          (l.model?.toLowerCase().includes(search) ?? false)
      );
    }

    const total = logs.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 20;
    const paginated = logs.slice(offset, offset + limit);

    return { logs: paginated, total };
  }

  getLogById(id: string): RequestLog | undefined {
    return this.logBuffer.find((l) => l.id === id);
  }

  clearLogs(): void {
    this.logBuffer.clear();
  }

  getStats(): {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgLatency: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
  } {
    const logs = this.logBuffer.toArray();
    const successLogs = logs.filter((l) => l.status === 'success');
    const errorLogs = logs.filter((l) => l.status === 'error');
    const latencies = successLogs.filter((l) => l.latencyMs > 0).map((l) => l.latencyMs);
    const avgLatency =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const totalInputTokens = successLogs.reduce((sum, l) => sum + (l.inputTokens ?? 0), 0);
    const totalOutputTokens = successLogs.reduce((sum, l) => sum + (l.outputTokens ?? 0), 0);
    const totalTokens = successLogs.reduce((sum, l) => sum + (l.totalTokens ?? 0), 0);
    const totalCost = successLogs.reduce((sum, l) => sum + (l.totalCost ?? 0), 0);

    return {
      totalRequests: logs.length,
      successCount: successLogs.length,
      errorCount: errorLogs.length,
      avgLatency: Math.round(avgLatency),
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCost: Math.round(totalCost * 100) / 100,
    };
  }
}

export const requestLogger = new RequestLogger();
