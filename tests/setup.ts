import { beforeAll, afterAll, vi } from 'vitest';

beforeAll(() => {
  vi.mock('./src/config/index.js', () => ({
    getConfig: () => ({
      server: { host: '0.0.0.0', port: 3000 },
      logging: { level: 'silent', pretty: false },
      rateLimit: { enabled: false },
      cors: { enabled: false },
      providers: {
        primary: {
          type: 'openai',
          apiKey: 'test-key',
          baseUrl: 'http://localhost:11434/v1',
        },
      },
      modelMapping: {
        'claude-3-5-sonnet-20240620': 'llama-3.1-70b-instruct',
      },
      router: { strategy: 'failover', circuitBreaker: { enabled: false } },
    }),
    getLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    initLogger: vi.fn(),
    loadConfig: vi.fn(),
  }));
});

afterAll(() => {
  vi.resetAllMocks();
});
