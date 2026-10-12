import { randomBytes } from 'node:crypto';
import { defineConfig } from '@playwright/test';

// Real API + real PostgreSQL, no request mocking. Requires E2E_DATABASE_URL pointing at a
// disposable database: global setup migrates it and re-seeds the demo workspace.
const API_PORT = 4100;
const CLIENT_PORT = 4174;
const databaseUrl = process.env.E2E_DATABASE_URL ?? '';

export default defineConfig({
  testDir: './client/e2e-fullstack',
  globalSetup: './client/e2e-fullstack/globalSetup.ts',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${CLIENT_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'npm run build -w @till-tally/analytics-contracts && npm run build -w server && node server/dist/app.js',
      env: {
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        CLIENT_ORIGIN: `http://127.0.0.1:${CLIENT_PORT}`,
        JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
        JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
      },
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `npm run build -w client && npm run preview -w client -- --host 127.0.0.1 --port ${CLIENT_PORT} --strictPort`,
      env: {
        VITE_BASE_PATH: '/',
        VITE_STATIC_PREVIEW: 'false',
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
      },
      url: `http://127.0.0.1:${CLIENT_PORT}/`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
