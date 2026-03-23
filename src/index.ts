import 'dotenv/config';
import { loadConfig, initLogger, getConfig } from './config/index.js';
import { startServer } from './server/index.js';
import { adminStore } from './admin-store.js';

async function main(): Promise<void> {
  loadConfig();
  initLogger();

  const config = getConfig();

  adminStore.initializeFromConfig({
    primary: {
      apiKey: config.providers.primary?.apiKey,
      baseUrl: config.providers.primary?.baseUrl,
      model: config.providers.primary?.model,
      timeout: config.providers.primary?.timeout,
    },
    fallback: {
      apiKey: config.providers.fallback?.apiKey,
      baseUrl: config.providers.fallback?.baseUrl,
      model: config.providers.fallback?.model,
      timeout: config.providers.fallback?.timeout,
    },
  });

  await startServer();
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
