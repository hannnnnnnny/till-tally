import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './auth/AuthPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { BusinessProvider } from './businesses/BusinessContext';
import { AppShell } from './layout/AppShell';
import { DEFAULT_APP_PATH } from './navigation/routes';
import { DashboardPage } from './pages/DashboardPage';
import { ImportsPage } from './pages/ImportsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { WorkspacePage } from './pages/WorkspacePage';

export default function App() {
  return (
    <ProtectedRoute fallback={<AuthPage />}>
      <BusinessProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to={DEFAULT_APP_PATH} replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="imports" element={<ImportsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="workspace" element={<WorkspacePage />} />
              <Route path="*" element={<Navigate to={DEFAULT_APP_PATH} replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BusinessProvider>
    </ProtectedRoute>
  );
}
