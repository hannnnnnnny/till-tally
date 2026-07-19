import { DEMO_READ_ONLY_RESPONSE } from './authHandlers';
import { demoErrorResponse, type DemoRoute } from './router';
import { readJsonItem, writeJsonItem, type DemoStorage } from './demoStorage';

type DashboardRangeFixture = {
  channelBreakdown: unknown;
  range: { from: string; to: string };
  salesTrend: unknown;
  summary: unknown;
};

export type DemoDashboardFixture = {
  ranges: Record<string, { current: DashboardRangeFixture; previous: DashboardRangeFixture }>;
};

type ProductRow = {
  category: string | null;
  grossMarginPct: number;
  labels: string[];
  name: string;
  revenue: number;
  sku: string;
  unitsSold: number;
  vendor: string | null;
};

export type DemoProductsFixture = {
  data: ProductRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export type DemoImportsFixture = { data: Array<{ id: string }>; meta: unknown };

export type DemoReportsFixture = { notFound: unknown; report: unknown };

export type DemoReadFixtures = {
  dashboard: DemoDashboardFixture;
  imports: DemoImportsFixture;
  inventory: unknown;
  products: DemoProductsFixture;
  reports: DemoReportsFixture;
};

type ReadHandlerOptions = {
  storage: DemoStorage;
  // Injectable for tests; defaults to the viewer's local calendar date.
  today?: () => string;
};

const REPORT_GENERATED_KEY = 'tilltally-demo-weekly-report';
const DAY_MS = 86_400_000;

export function createReadRoutes(
  fixtures: DemoReadFixtures,
  options: ReadHandlerOptions,
): DemoRoute[] {
  const today = options.today ?? localDateToday;
  const dashboardHandler =
    (pick: (entry: DashboardRangeFixture) => unknown): DemoRoute['handler'] =>
    ({ searchParams }) =>
      ({
        json: pick(selectDashboardRange(fixtures.dashboard, searchParams, today())),
        status: 200,
      }) as const;

  return [
    {
      handler: dashboardHandler((entry) => entry.summary),
      method: 'GET',
      template: '/api/dashboard/summary',
    },
    {
      handler: dashboardHandler((entry) => entry.salesTrend),
      method: 'GET',
      template: '/api/dashboard/sales-trend',
    },
    {
      handler: dashboardHandler((entry) => entry.channelBreakdown),
      method: 'GET',
      template: '/api/dashboard/channel-breakdown',
    },
    {
      handler: ({ searchParams }) => ({
        json: queryProducts(fixtures.products, searchParams),
        status: 200,
      }),
      method: 'GET',
      template: '/api/products/performance',
    },
    {
      handler: () => ({ json: fixtures.inventory, status: 200 }),
      method: 'GET',
      template: '/api/inventory/insights',
    },
    {
      handler: () => ({ json: fixtures.imports, status: 200 }),
      method: 'GET',
      template: '/api/import/jobs',
    },
    {
      handler: ({ params }) => {
        const job = fixtures.imports.data.find((candidate) => candidate.id === params.jobId);

        return job
          ? { json: job, status: 200 }
          : demoErrorResponse(404, 'NOT_FOUND', 'Import job not found');
      },
      method: 'GET',
      template: '/api/import/jobs/:jobId',
    },
    { handler: () => DEMO_READ_ONLY_RESPONSE, method: 'POST', template: '/api/import/orders' },
    { handler: () => DEMO_READ_ONLY_RESPONSE, method: 'POST', template: '/api/import/products' },
    {
      handler: () =>
        readJsonItem<boolean>(options.storage, REPORT_GENERATED_KEY) === true
          ? { json: fixtures.reports.report, status: 200 }
          : { json: fixtures.reports.notFound, status: 404 },
      method: 'GET',
      template: '/api/reports/weekly',
    },
    {
      handler: () => {
        writeJsonItem(options.storage, REPORT_GENERATED_KEY, true);
        return { json: fixtures.reports.report, status: 200 };
      },
      method: 'POST',
      template: '/api/reports/weekly/generate',
    },
  ];
}

// The viewer's "today" drifts away from the recording day, so requests are
// matched by window span and by whether they end near today (current window)
// rather than by exact recorded dates.
function selectDashboardRange(
  fixture: DemoDashboardFixture,
  searchParams: URLSearchParams,
  todayValue: string,
): DashboardRangeFixture {
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const fallback = fixture.ranges['30'] ?? Object.values(fixture.ranges)[0];

  if (!from || !to) {
    return fallback.current;
  }

  const spanDays = Math.round((parseDay(to) - parseDay(from)) / DAY_MS) + 1;
  const entry = fixture.ranges[String(spanDays)] ?? fallback;
  const daysBehindToday = Math.round((parseDay(todayValue) - parseDay(to)) / DAY_MS);

  return daysBehindToday >= spanDays ? entry.previous : entry.current;
}

function queryProducts(
  fixture: DemoProductsFixture,
  searchParams: URLSearchParams,
): DemoProductsFixture {
  const search = searchParams.get('search')?.toLowerCase() ?? '';
  const category = searchParams.get('category')?.toLowerCase() ?? '';
  const status = searchParams.get('status')?.toLowerCase() ?? '';
  const sort = searchParams.get('sort') ?? 'revenue';
  const order = searchParams.get('order') === 'asc' ? 1 : -1;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20);

  const filtered = fixture.data.filter((row) => matchesProductFilters(row, search, category, status));
  const sortValue = (row: ProductRow): number =>
    sort === 'unitsSold' ? row.unitsSold : sort === 'grossMargin' ? row.grossMarginPct : row.revenue;
  const sorted = [...filtered].sort((a, b) => (sortValue(a) - sortValue(b)) * order);
  const start = (page - 1) * pageSize;

  return {
    data: sorted.slice(start, start + pageSize),
    meta: {
      page,
      pageSize,
      total: sorted.length,
      totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)),
    },
  };
}

// Mirrors the server's matchesProductFilters semantics.
function matchesProductFilters(
  row: ProductRow,
  search: string,
  category: string,
  status: string,
): boolean {
  if (
    search &&
    ![row.sku, row.name, row.category, row.vendor]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(search))
  ) {
    return false;
  }

  if (category && row.category?.toLowerCase() !== category) {
    return false;
  }

  return !status || row.labels.some((label) => label.toLowerCase() === status);
}

function parseDay(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function localDateToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}
