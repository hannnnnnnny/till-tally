import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './auth/AuthPage';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { BusinessProvider } from './businesses/BusinessContext';
import { LandingPage } from './landing/LandingPage';
import { AppShell } from './layout/AppShell';
import { DEFAULT_APP_PATH } from './navigation/routes';
import { DashboardPage } from './pages/DashboardPage';
import { ImportsPage } from './pages/ImportsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { WorkspacePage } from './pages/WorkspacePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthRoute />} />
        <Route
          element={
            <ProtectedRoute fallback={<Navigate to="/auth" replace />}>
              <BusinessProvider>
                <AppShell />
              </BusinessProvider>
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function AuthRoute() {
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

  if (status === 'authenticated') {
    return <Navigate to={DEFAULT_APP_PATH} replace />;
  }

  return <AuthPage />;
}
