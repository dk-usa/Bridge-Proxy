export interface ParsedChunk {
  event?: string;
  data: string;
  id?: string;
}

export class StreamParser {
  private buffer: string = '';
  private readonly separator: string = '\n\n';

  parse(rawData: string): ParsedChunk[] {
    this.buffer += rawData;
    const chunks: ParsedChunk[] = [];

    const trimmedBuffer = this.buffer.trim();

    if (
      trimmedBuffer &&
      !trimmedBuffer.startsWith('data:') &&
      !trimmedBuffer.startsWith('event:')
    ) {
      try {
        JSON.parse(trimmedBuffer);
        const parsedChunk: ParsedChunk = { data: trimmedBuffer };
        this.buffer = '';
        return [parsedChunk];
      } catch {
        // Not valid JSON, continue with SSE parsing
      }
    }

    let separatorIndex = this.buffer.indexOf(this.separator);

    while (separatorIndex !== -1) {
      const chunkStr = this.buffer.slice(0, separatorIndex);
      this.buffer = this.buffer.slice(separatorIndex + this.separator.length);

      const parsed = this.parseChunk(chunkStr);
      if (parsed) {
        chunks.push(parsed);
      }

      separatorIndex = this.buffer.indexOf(this.separator);
    }

    return chunks;
  }

  private parseChunk(chunkStr: string): ParsedChunk | null {
    const lines = chunkStr.split('\n');
    let event: string | undefined;
    let data: string = '';
    let id: string | undefined;

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.slice(5).trim();
      } else if (line.startsWith('id:')) {
        id = line.slice(3).trim();
      }
    }

    if (!data) {
      return null;
    }

    return { event, data, id };
  }

  getRemainingBuffer(): string {
    return this.buffer;
  }

  clear(): void {
    this.buffer = '';
  }
}

export function createStreamParser(): StreamParser {
  return new StreamParser();
}

export function parseSSEData(data: string): unknown {
  if (data.startsWith('data: ')) {
    const jsonStr = data.slice(6).trim();
    if (jsonStr === '[DONE]') {
      return null;
    }
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
