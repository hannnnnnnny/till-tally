import { type RequestHandler, type Response, Router } from 'express';
import { asyncHandler } from '../http/asyncHandler';
import {
  ProductPerformanceQueryError,
  type ProductDetail,
  type ProductPerformanceQueryInput,
  type ProductPerformanceResult,
} from './productPerformanceService';

export type ProductsRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  listProductPerformance: (
    businessId: string,
    query: ProductPerformanceQueryInput,
  ) => Promise<ProductPerformanceResult>;
  getProductDetail: (
    businessId: string,
    productId: string,
    query: ProductPerformanceQueryInput,
  ) => Promise<ProductDetail | null>;
};

type ProductErrorCode = 'BAD_PRODUCT_QUERY' | 'NO_BUSINESS_ACCESS' | 'NOT_FOUND';

function sendProductError(
  res: Response,
  statusCode: number,
  code: ProductErrorCode,
  message: string,
): void {
  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

export function createProductsRouter(routerDependencies: ProductsRouterDependencies): Router {
  const router = Router();

  router.get(
    '/performance',
    routerDependencies.requireAuth,
    routerDependencies.requireBusinessAccess,
    asyncHandler(async (req, res) => {
      if (!req.businessId) {
        sendProductError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      try {
        const result = await routerDependencies.listProductPerformance(req.businessId, req.query);

        res.json(result);
      } catch (error) {
        if (error instanceof ProductPerformanceQueryError) {
          sendProductError(res, 400, 'BAD_PRODUCT_QUERY', error.message);
          return;
        }

        throw error;
      }
    }),
  );

  router.get(
    '/:id',
    routerDependencies.requireAuth,
    routerDependencies.requireBusinessAccess,
    asyncHandler(async (req, res) => {
      if (!req.businessId) {
        sendProductError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      try {
        const result = await routerDependencies.getProductDetail(req.businessId, req.params.id, req.query);

        if (!result) {
          sendProductError(res, 404, 'NOT_FOUND', 'Product not found');
          return;
        }

        res.json(result);
      } catch (error) {
        if (error instanceof ProductPerformanceQueryError) {
          sendProductError(res, 400, 'BAD_PRODUCT_QUERY', error.message);
          return;
        }

        throw error;
      }
    }),
  );

  return router;
}
