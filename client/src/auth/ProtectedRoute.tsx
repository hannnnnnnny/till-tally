import { type ReactNode } from 'react';
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
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          Loading session...
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return fallback;
  }

  return <>{children}</>;
}
