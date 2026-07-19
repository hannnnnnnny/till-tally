import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext.tsx';
import { runtimeConfig } from './config/runtime.ts';
import './index.css';

async function bootstrap(): Promise<void> {
  // Demo fetch interception must be in place before the auth provider fires
  // its first session request.
  if (runtimeConfig.isDemo) {
    const { setupDemo } = await import('./demo');
    setupDemo();
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element #root not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
}

void bootstrap();
