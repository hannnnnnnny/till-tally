import { type Request, type RequestHandler, type Response, Router } from 'express';
import {
  InventoryRiskQueryError,
  type InventoryInsights,
  type InventoryRiskItem,
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
type InventoryListGroup = 'lowStock' | 'slowMovers';
type InventoryQueryAliases = Record<string, string>;
type InventoryListPagination = {
  page: number;
  pageSize: number;
};
type InventoryListResponse = {
  generatedAt: string;
  salesWindow: InventoryInsights['salesWindow'];
  total: number;
  page: number;
  pageSize: number;
  items: InventoryRiskItem[];
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PAGINATION_QUERY_PARAMS = new Set(['page', 'pageSize']);

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

  router.get(
    '/low-stock',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    async (req, res) => {
      await sendInventoryListResponse(req, res, dependencies, 'lowStock', {
        threshold: 'lowStockThreshold',
      });
    },
  );

  router.get(
    '/slow-movers',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    async (req, res) => {
      await sendInventoryListResponse(req, res, dependencies, 'slowMovers', {
        days: 'slowMoverDays',
      });
    },
  );

  return router;
}

async function sendInventoryListResponse(
  req: Request,
  res: Response,
  dependencies: InventoryRouterDependencies,
  group: InventoryListGroup,
  aliases: InventoryQueryAliases,
): Promise<void> {
  if (!req.businessId) {
    sendInventoryError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
    return;
  }

  try {
    const pagination = parseInventoryListPagination(req.query);
    const query = createInventoryRiskQuery(req.query, aliases);
    const insights = await dependencies.getInventoryInsights(req.businessId, query);

    res.json(createInventoryListResponse(insights, group, pagination));
  } catch (error) {
    if (error instanceof InventoryRiskQueryError) {
      sendInventoryError(res, 400, 'BAD_INVENTORY_QUERY', error.message);
      return;
    }

    throw error;
  }
}

function createInventoryListResponse(
  insights: InventoryInsights,
  group: InventoryListGroup,
  pagination: InventoryListPagination,
): InventoryListResponse {
  const items = insights[group];

  return {
    generatedAt: insights.generatedAt,
    salesWindow: insights.salesWindow,
    total: items.length,
    page: pagination.page,
    pageSize: pagination.pageSize,
    items: paginateItems(items, pagination),
  };
}

function createInventoryRiskQuery(
  query: InventoryRiskQueryInput,
  aliases: InventoryQueryAliases,
): InventoryRiskQueryInput {
  const inventoryQuery: InventoryRiskQueryInput = {};

  for (const [name, value] of Object.entries(query)) {
    if (PAGINATION_QUERY_PARAMS.has(name)) {
      continue;
    }

    inventoryQuery[aliases[name] ?? name] = value;
  }

  return inventoryQuery;
}

function parseInventoryListPagination(query: InventoryRiskQueryInput): InventoryListPagination {
  const page = parsePositiveInteger('page', readQueryString(query, 'page'), DEFAULT_PAGE);
  const pageSize = Math.min(
    parsePositiveInteger('pageSize', readQueryString(query, 'pageSize'), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  return {
    page,
    pageSize,
  };
}

function paginateItems(
  items: InventoryRiskItem[],
  pagination: InventoryListPagination,
): InventoryRiskItem[] {
  const startIndex = (pagination.page - 1) * pagination.pageSize;

  return items.slice(startIndex, startIndex + pagination.pageSize);
}

function readQueryString(query: InventoryRiskQueryInput, name: string): string | null {
  const value = query[name];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed || null;
  }

  throw new InventoryRiskQueryError(`${name} must be a string`);
}

function parsePositiveInteger(name: string, value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InventoryRiskQueryError(`${name} must be a positive integer`);
  }

  return parsed;
}
