import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SalesChannel } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createProductsRouter, type ProductsRouterDependencies } from './productRouterFactory';
import {
  ProductPerformanceQueryError,
  type ProductDetail,
  type ProductPerformanceResult,
} from './productPerformanceService';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe('product routes', () => {
  it('returns product performance for the active business', async () => {
    let capturedRequest: {
      businessId: string;
      sort: unknown;
      status: unknown;
    } | null = null;

    const app = createTestApp({
      listProductPerformance: async (businessId, query) => {
        capturedRequest = {
          businessId,
          sort: query.sort,
          status: query.status,
        };

        return createPerformanceResult();
      },
    });

    const response = await request(app)
      .get('/api/products/performance?sort=unitsSold&status=High%20Margin')
      .expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      sort: 'unitsSold',
      status: 'High Margin',
    });
    assert.deepEqual(response.body, createPerformanceResult());
  });

  it('returns 400 for invalid performance query params', async () => {
    const app = createTestApp({
      listProductPerformance: async () => {
        throw new ProductPerformanceQueryError('sort must be revenue, unitsSold, or grossMargin');
      },
    });

    const response = await request(app).get('/api/products/performance?sort=bad').expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_PRODUCT_QUERY');
    assert.equal(body.error.message, 'sort must be revenue, unitsSold, or grossMargin');
  });

  it('returns product detail for the active business', async () => {
    let capturedRequest: {
      businessId: string;
      productId: string;
    } | null = null;

    const app = createTestApp({
      getProductDetail: async (businessId, productId) => {
        capturedRequest = {
          businessId,
          productId,
        };

        return createProductDetail();
      },
    });

    const response = await request(app).get('/api/products/product-1').expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      productId: 'product-1',
    });
    assert.deepEqual(response.body, createProductDetail());
  });

  it('returns 404 when product detail is outside the active business', async () => {
    const app = createTestApp({
      getProductDetail: async () => null,
    });

    const response = await request(app).get('/api/products/missing-product').expect(404);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.message, 'Product not found');
  });
});

function createTestApp(overrides: Partial<ProductsRouterDependencies>): express.Express {
  const app = express();

  app.use(express.json());
  app.use('/api/products', createProductsRouter({ ...createDefaultDependencies(), ...overrides }));

  return app;
}

function createDefaultDependencies(): ProductsRouterDependencies {
  return {
    requireAuth: createAuthMiddleware(),
    requireBusinessAccess: createBusinessAccessMiddleware(),
    listProductPerformance: async () => createPerformanceResult(),
    getProductDetail: async () => createProductDetail(),
  };
}

function createAuthMiddleware(): RequestHandler {
  return (req, _res, next) => {
    req.userId = 'user-1';
    next();
  };
}

function createBusinessAccessMiddleware(): RequestHandler {
  return (req, _res, next) => {
    req.businessId = 'business-1';
    next();
  };
}

function createPerformanceResult(): ProductPerformanceResult {
  return {
    data: [
      {
        id: 'product-1',
        rank: 1,
        sku: 'WJ-001',
        name: "Women's Jacket",
        category: "Women's Fashion",
        vendor: 'Local Supplier',
        unitsSold: 24,
        revenue: 2157.6,
        cost: 912,
        grossProfit: 1245.6,
        grossMarginPct: 57.73,
        abcClass: 'A',
        revenueContributionPct: 78.24,
        cumulativeRevenuePct: 78.24,
        currentStock: 3,
        lastSoldAt: '2026-06-24',
        labels: ['Best Seller', 'High Margin', 'Low Stock', 'Reorder Soon'],
      },
    ],
    meta: {
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    },
  };
}

function createProductDetail(): ProductDetail {
  return {
    ...createPerformanceResult().data[0],
    recentSales: [
      {
        orderDate: '2026-06-24',
        orderNumber: '1001',
        channel: SalesChannel.SHOPIFY,
        quantity: 24,
        revenue: 2157.6,
        grossProfit: 1245.6,
      },
    ],
    stockHistory: [
      {
        date: '2026-06-24',
        stockQuantity: 3,
      },
    ],
  };
}
