export function generateId(prefix: string = 'msg'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}${randomPart}`;
}

export function generateMessageId(): string {
  return generateId('msg');
}

export function generateRequestId(): string {
  return generateId('req');
}

export function generateTraceId(): string {
  return generateId('trace');
}
