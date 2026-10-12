import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the Express server; `vite preview` reuses this for full-stack E2E.
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
    },
  },
});
