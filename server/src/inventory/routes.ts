import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { getInventoryInsights } from './inventoryRiskService';
import { createInventoryRouter, type InventoryRouterDependencies } from './inventoryRouterFactory';

const dependencies: InventoryRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  getInventoryInsights,
};

export const inventoryRouter = createInventoryRouter(dependencies);
