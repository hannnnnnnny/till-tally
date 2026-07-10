import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createInventoryRouter, type InventoryRouterDependencies } from './inventoryRouterFactory';
import {
  InventoryRiskQueryError,
  type InventoryInsights,
  type InventoryRiskItem,
  type InventoryRiskQueryInput,
} from './inventoryRiskService';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe('inventory routes', () => {
  it('returns inventory insights for the active business', async () => {
    let capturedRequest: {
      businessId: string;
      query: InventoryRiskQueryInput;
    } | null = null;

    const app = createTestApp({
      getInventoryInsights: async (businessId, query) => {
        capturedRequest = {
          businessId,
          query,
        };

        return createInsights();
      },
    });

    const response = await request(app).get('/api/inventory/insights?to=2026-07-03').expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      query: {
        to: '2026-07-03',
      },
    });
    assert.deepEqual(response.body, createInsights());
  });

  it('returns 400 for invalid inventory insight query params', async () => {
    const app = createTestApp({
      getInventoryInsights: async () => {
        throw new InventoryRiskQueryError('lowStockThreshold must be a positive integer');
      },
    });

    const response = await request(app)
      .get('/api/inventory/insights?lowStockThreshold=0')
      .expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_INVENTORY_QUERY');
    assert.equal(body.error.message, 'lowStockThreshold must be a positive integer');
  });

  it('returns paginated low-stock products with the threshold query alias', async () => {
    let capturedRequest: {
      businessId: string;
      query: InventoryRiskQueryInput;
    } | null = null;

    const app = createTestApp({
      getInventoryInsights: async (businessId, query) => {
        capturedRequest = {
          businessId,
          query,
        };

        return createInsights();
      },
    });

    const response = await request(app)
      .get('/api/inventory/low-stock?threshold=7&page=2&pageSize=1&to=2026-07-03')
      .expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      query: {
        lowStockThreshold: '7',
        to: '2026-07-03',
      },
    });
    assert.deepEqual(response.body, {
      generatedAt: '2026-07-03',
      salesWindow: createInsights().salesWindow,
      total: 2,
      page: 2,
      pageSize: 1,
      items: [createLowStockItem('product-2')],
    });
  });

  it('returns paginated slow movers with the days query alias', async () => {
    let capturedRequest: {
      businessId: string;
      query: InventoryRiskQueryInput;
    } | null = null;

    const app = createTestApp({
      getInventoryInsights: async (businessId, query) => {
        capturedRequest = {
          businessId,
          query,
        };

        return createInsights();
      },
    });

    const response = await request(app)
      .get('/api/inventory/slow-movers?days=45&to=2026-07-03')
      .expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      query: {
        slowMoverDays: '45',
        to: '2026-07-03',
      },
    });
    assert.deepEqual(response.body, {
      generatedAt: '2026-07-03',
      salesWindow: createInsights().salesWindow,
      total: 1,
      page: 1,
      pageSize: 20,
      items: [createSlowMoverItem()],
    });
  });

  it('returns 400 for invalid inventory list pagination', async () => {
    const app = createTestApp({});

    const response = await request(app).get('/api/inventory/low-stock?page=0').expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_INVENTORY_QUERY');
    assert.equal(body.error.message, 'page must be a positive integer');
  });
});

function createTestApp(overrides: Partial<InventoryRouterDependencies>): express.Express {
  const app = express();

  app.use(express.json());
  app.use(
    '/api/inventory',
    createInventoryRouter({ ...createDefaultDependencies(), ...overrides }),
  );

  return app;
}

function createDefaultDependencies(): InventoryRouterDependencies {
  return {
    requireAuth: createAuthMiddleware(),
    requireBusinessAccess: createBusinessAccessMiddleware(),
    getInventoryInsights: async () => createInsights(),
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

function createInsights(): InventoryInsights {
  const item = createLowStockItem('product-1');
  const secondLowStockItem = createLowStockItem('product-2');
  const slowMoverItem = createSlowMoverItem();

  return {
    generatedAt: '2026-07-03',
    salesWindow: {
      from: '2026-06-04',
      to: '2026-07-03',
      days: 30,
    },
    summary: {
      lowStock: 2,
      stockoutRisk: 1,
      slowMovers: 1,
      deadStock: 0,
      reorderSoon: 1,
      discountCandidates: 1,
      overstocked: 0,
    },
    reorderSoon: [item],
    lowStock: [item, secondLowStockItem],
    stockoutRisk: [item],
    slowMovers: [slowMoverItem],
    deadStock: [],
    discountCandidates: [slowMoverItem],
    overstocked: [],
  };
}

function createLowStockItem(id: string): InventoryRiskItem {
  return {
    id,
    sku: 'WJ-001',
    name: "Women's Jacket",
    category: "Women's Fashion",
    vendor: 'Local Supplier',
    currentStock: 3,
    lastSoldAt: '2026-06-24',
    unitsSoldLast30: 24,
    dailySalesRate: 0.8,
    daysOfStockLeft: 4,
    labels: ['Low Stock', 'Stockout Risk', 'Reorder Soon'],
    recommendation: 'Reorder soon',
  };
}

function createSlowMoverItem(): InventoryRiskItem {
  return {
    id: 'product-3',
    sku: 'SL-001',
    name: 'Slow Product',
    category: 'Inventory',
    vendor: 'Local Supplier',
    currentStock: 14,
    lastSoldAt: '2026-04-20',
    unitsSoldLast30: 0,
    dailySalesRate: 0,
    daysOfStockLeft: null,
    labels: ['Slow Mover', 'Discount Candidate'],
    recommendation: 'Review placement or discount',
  };
}
