import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the Express server during local development.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
