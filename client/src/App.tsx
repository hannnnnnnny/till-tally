import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './auth/AuthPage';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { BusinessProvider } from './businesses/BusinessContext';
import { runtimeConfig } from './config/runtime';
import { LandingPage } from './landing/LandingPage';
import { AppShell } from './layout/AppShell';
import { DEFAULT_APP_PATH } from './navigation/routes';
import { ChannelsPage } from './pages/ChannelsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportsPage } from './pages/ImportsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { ReportsPage } from './pages/ReportsPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { StatePanel } from './ui/StatePanel';

export default function App() {
  const Router = runtimeConfig.routerMode === 'hash' ? HashRouter : BrowserRouter;

  return (
    <Router>
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
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="reports/weekly" element={<ReportsPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function AuthRoute() {
  const { status } = useAuth();

  if (runtimeConfig.isStaticPreview) {
    return <Navigate to="/" replace />;
  }

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

  if (status === 'authenticated') {
    return <Navigate to={DEFAULT_APP_PATH} replace />;
  }

  return <AuthPage />;
}
