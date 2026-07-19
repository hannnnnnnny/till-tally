import { defineConfig } from '@playwright/test';

// Smoke suite for the recorded-fixture demo build; it doubles as the Pages
// deployment gate, so it must run without any backend.
export default defineConfig({
  testDir: './client/e2e-demo',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    viewport: { height: 812, width: 375 },
  },
  webServer: {
    command:
      'npm run build -w client && npm run preview -w client -- --host 127.0.0.1 --port 4174 --strictPort',
    env: {
      VITE_BASE_PATH: '/',
      VITE_DEMO_MODE: 'true',
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:4174/',
  },
});
