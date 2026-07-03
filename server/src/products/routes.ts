import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { createProductsRouter, type ProductsRouterDependencies } from './productRouterFactory';
import { getProductDetail, listProductPerformance } from './productPerformanceService';

const dependencies: ProductsRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  listProductPerformance,
  getProductDetail,
};

export const productsRouter = createProductsRouter(dependencies);
