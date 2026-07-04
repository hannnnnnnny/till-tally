import { type ReactNode } from 'react';
import { StatePanel } from '../ui/StatePanel';
import { useAuth } from './AuthContext';

type ProtectedRouteProps = {
  children: ReactNode;
  fallback: ReactNode;
};

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <StatePanel
          tone="loading"
          minHeight="sm"
          className="w-full max-w-sm bg-white shadow-sm"
          message="Loading session..."
        />
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return fallback;
  }

  return <>{children}</>;
}
