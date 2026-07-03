import { type RequestHandler, type Response, Router } from 'express';
import {
  InventoryRiskQueryError,
  type InventoryInsights,
  type InventoryRiskQueryInput,
} from './inventoryRiskService';

export type InventoryRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  getInventoryInsights: (
    businessId: string,
    query: InventoryRiskQueryInput,
  ) => Promise<InventoryInsights>;
};

type InventoryErrorCode = 'BAD_INVENTORY_QUERY' | 'NO_BUSINESS_ACCESS';

function sendInventoryError(
  res: Response,
  statusCode: number,
  code: InventoryErrorCode,
  message: string,
): void {
  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

export function createInventoryRouter(dependencies: InventoryRouterDependencies): Router {
  const router = Router();

  router.get(
    '/insights',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    async (req, res) => {
      if (!req.businessId) {
        sendInventoryError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      try {
        const result = await dependencies.getInventoryInsights(req.businessId, req.query);

        res.json(result);
      } catch (error) {
        if (error instanceof InventoryRiskQueryError) {
          sendInventoryError(res, 400, 'BAD_INVENTORY_QUERY', error.message);
          return;
        }

        throw error;
      }
    },
  );

  return router;
}
