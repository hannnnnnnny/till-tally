export type AppRouteId = 'dashboard' | 'imports' | 'products' | 'inventory' | 'workspace';

export type AppNavItem = {
  id: AppRouteId;
  label: string;
  path: string;
  description: string;
};

export const DEFAULT_APP_PATH = '/dashboard';

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    description: 'Business overview',
  },
  {
    id: 'imports',
    label: 'Imports',
    path: '/imports',
    description: 'CSV uploads and history',
  },
  {
    id: 'products',
    label: 'Products',
    path: '/products',
    description: 'Performance and stock status',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    path: '/inventory',
    description: 'Risk and replenishment',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    path: '/workspace',
    description: 'Businesses and settings',
  },
];

export function getRouteTitle(pathname: string): string {
  return APP_NAV_ITEMS.find((item) => pathname.startsWith(item.path))?.label ?? 'Dashboard';
}
