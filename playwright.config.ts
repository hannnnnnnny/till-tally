import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './client/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npm run build -w client && npm run preview -w client -- --host 127.0.0.1 --port 4173 --strictPort',
    env: {
      VITE_BASE_PATH: '/till-tally/',
      VITE_STATIC_PREVIEW: 'true',
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:4173/till-tally/',
  },
});
