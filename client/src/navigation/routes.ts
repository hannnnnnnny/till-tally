export type AppRouteId =
  | 'dashboard'
  | 'channels'
  | 'imports'
  | 'products'
  | 'inventory'
  | 'reports'
  | 'workspace';

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
    id: 'channels',
    label: 'Channels',
    path: '/channels',
    description: 'Revenue and margin mix',
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
    id: 'reports',
    label: 'Reports',
    path: '/reports/weekly',
    description: 'Weekly summary and actions',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    path: '/workspace',
    description: 'Businesses and settings',
  },
];

const MOBILE_PRIMARY_ROUTE_IDS: AppRouteId[] = ['dashboard', 'imports', 'products', 'inventory'];

const MOBILE_MORE_ROUTE_IDS: AppRouteId[] = ['channels', 'reports', 'workspace'];

export const MOBILE_PRIMARY_NAV_ITEMS = MOBILE_PRIMARY_ROUTE_IDS.map(getNavItem);

export const MOBILE_MORE_NAV_ITEMS = MOBILE_MORE_ROUTE_IDS.map(getNavItem);

export function getRouteTitle(pathname: string): string {
  return APP_NAV_ITEMS.find((item) => pathname.startsWith(item.path))?.label ?? 'Dashboard';
}

function getNavItem(id: AppRouteId): AppNavItem {
  const item = APP_NAV_ITEMS.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`Missing navigation item: ${id}`);
  }

  return item;
}
