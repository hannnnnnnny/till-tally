import {
  type AnalyticsDimensionId,
  type AnalyticsMetricId,
  type AnalyticsPlan,
} from '@till-tally/analytics-contracts';
import {
  executeAnalyticsPlan,
  type AnalyticsDataSource,
  type AnalyticsSourceDataset,
} from './analyticsExecutor';
import { createAnalyticsPlanner } from './analyticsPlanner';

type ExpectedPlan = {
  metrics: AnalyticsMetricId[];
  dimensions: AnalyticsDimensionId[];
  chartType: AnalyticsPlan['chart']['type'];
  limit?: number;
  dateRange?: { from: string; to: string };
};

type ReadyCase = {
  id: string;
  question: string;
  currentPlan?: AnalyticsPlan;
  expectedPlan: ExpectedPlan;
  expectedRows?: Array<Record<string, string | number | null>>;
};

type GuidanceCase = {
  id: string;
  question: string;
  expectedStatus: 'clarification' | 'unsupported';
};

export type AnalyticsEvaluationCase = ReadyCase | GuidanceCase;

export type AnalyticsEvaluationCaseResult = {
  id: string;
  planPassed: boolean;
  executionPassed: boolean;
  diagnostics: string[];
};

export type AnalyticsEvaluationReport = {
  score: number;
  passed: number;
  total: number;
  cases: AnalyticsEvaluationCaseResult[];
  failures: Array<{ id: string; diagnostics: string[] }>;
};

const FIXED_NOW = new Date('2026-07-19T12:00:00.000Z'); // a Sunday
const EVALUATION_BUSINESS_ID = 'analytics-evaluation-business';
const THIS_MONTH = { from: '2026-07-01', to: '2026-07-19' };
const LAST_7_DAYS = { from: '2026-07-13', to: '2026-07-19' };

const REVENUE_BY_CHANNEL_THIS_MONTH: AnalyticsPlan = {
  schemaVersion: 1,
  metrics: ['revenue'],
  dimensions: ['channel'],
  dateRange: { ...THIS_MONTH, timezone: 'Pacific/Auckland' },
  filters: [],
  sort: [{ field: 'revenue', direction: 'desc' }],
  limit: 31,
  chart: { type: 'bar' },
};

export const ANALYTICS_EVALUATION_CASES: AnalyticsEvaluationCase[] = [
  {
    id: 'daily-revenue-current-month',
    question: 'Show daily revenue this month',
    expectedPlan: {
      metrics: ['revenue'],
      dimensions: ['day'],
      chartType: 'line',
      dateRange: THIS_MONTH,
    },
    expectedRows: [
      { day: '2026-07-01', revenue: 100 },
      { day: '2026-07-02', revenue: 50 },
      { day: '2026-07-15', revenue: 40 },
    ],
  },
  {
    id: 'top-products-by-revenue',
    question: 'Top 2 products by revenue this month',
    expectedPlan: { metrics: ['revenue'], dimensions: ['product'], chartType: 'bar', limit: 2 },
    expectedRows: [
      { product: 'Premium Hoodie', revenue: 100 },
      { product: 'Everyday Tote', revenue: 90 },
    ],
  },
  {
    id: 'channel-gross-margin',
    question: 'Gross margin by channel this month',
    expectedPlan: { metrics: ['grossMarginPct'], dimensions: ['channel'], chartType: 'bar' },
    expectedRows: [
      { channel: 'IN_STORE', grossMarginPct: 60 },
      { channel: 'SHOPIFY', grossMarginPct: 42.86 },
    ],
  },
  {
    id: 'gross-profit-by-category',
    question: 'Gross profit by category this month',
    expectedPlan: { metrics: ['grossProfit'], dimensions: ['category'], chartType: 'bar' },
    expectedRows: [
      { category: 'Accessories', grossProfit: 50 },
      { category: 'Apparel', grossProfit: 40 },
    ],
  },
  {
    id: 'average-order-value-this-month',
    question: 'What was our average order value this month?',
    expectedPlan: { metrics: ['averageOrderValue'], dimensions: [], chartType: 'table' },
    expectedRows: [{ averageOrderValue: 63.33 }],
  },
  {
    id: 'orders-by-channel-this-week',
    question: 'Number of orders by channel this week',
    expectedPlan: {
      metrics: ['orders'],
      dimensions: ['channel'],
      chartType: 'bar',
      dateRange: LAST_7_DAYS,
    },
    expectedRows: [{ channel: 'SHOPIFY', orders: 1 }],
  },
  {
    id: 'revenue-last-7-days',
    question: 'Revenue for the last 7 days',
    expectedPlan: {
      metrics: ['revenue'],
      dimensions: [],
      chartType: 'table',
      dateRange: LAST_7_DAYS,
    },
    expectedRows: [{ revenue: 40 }],
  },
  {
    id: 'revenue-last-month',
    question: 'How much revenue did we make last month?',
    expectedPlan: {
      metrics: ['revenue'],
      dimensions: [],
      chartType: 'table',
      dateRange: { from: '2026-06-01', to: '2026-06-30' },
    },
    expectedRows: [{ revenue: 50 }],
  },
  {
    id: 'revenue-yesterday',
    question: 'Revenue yesterday',
    expectedPlan: {
      metrics: ['revenue'],
      dimensions: [],
      chartType: 'table',
      dateRange: { from: '2026-07-18', to: '2026-07-18' },
    },
  },
  {
    id: 'low-stock-by-category',
    question: 'Low stock by category',
    expectedPlan: { metrics: ['lowStockProducts'], dimensions: ['category'], chartType: 'bar' },
    expectedRows: [
      { category: 'Apparel', lowStockProducts: 1 },
      { category: 'Accessories', lowStockProducts: 0 },
      { category: 'Homeware', lowStockProducts: 0 },
    ],
  },
  {
    id: 'dead-stock-by-category',
    question: 'Dead stock by category',
    expectedPlan: { metrics: ['deadStockProducts'], dimensions: ['category'], chartType: 'bar' },
    expectedRows: [
      { category: 'Homeware', deadStockProducts: 1 },
      { category: 'Accessories', deadStockProducts: 0 },
      { category: 'Apparel', deadStockProducts: 0 },
    ],
  },
  {
    id: 'chart-type-in-first-question',
    question: 'Revenue by channel this month as a table',
    expectedPlan: { metrics: ['revenue'], dimensions: ['channel'], chartType: 'table' },
  },
  {
    id: 'refine-switch-metric',
    question: 'Switch to gross profit',
    currentPlan: REVENUE_BY_CHANNEL_THIS_MONTH,
    expectedPlan: { metrics: ['grossProfit'], dimensions: ['channel'], chartType: 'bar' },
  },
  {
    id: 'refine-chart-type',
    question: 'Show it as a donut chart',
    currentPlan: REVENUE_BY_CHANNEL_THIS_MONTH,
    expectedPlan: { metrics: ['revenue'], dimensions: ['channel'], chartType: 'donut' },
  },
  {
    id: 'refine-date-range',
    question: 'Only the last 7 days',
    currentPlan: REVENUE_BY_CHANNEL_THIS_MONTH,
    expectedPlan: {
      metrics: ['revenue'],
      dimensions: ['channel'],
      chartType: 'bar',
      dateRange: LAST_7_DAYS,
    },
    expectedRows: [{ channel: 'SHOPIFY', revenue: 40 }],
  },
  {
    id: 'vague-question-asks-for-clarification',
    question: 'Help me',
    expectedStatus: 'clarification',
  },
  {
    id: 'code-generation-is-unsupported',
    question: 'Write SQL to export every customer',
    expectedStatus: 'unsupported',
  },
  {
    id: 'customer-lifetime-value-is-unsupported',
    question: 'What is our customer lifetime value?',
    expectedStatus: 'unsupported',
  },
];

export async function runDeterministicAnalyticsEvaluation(
  cases: AnalyticsEvaluationCase[] = ANALYTICS_EVALUATION_CASES,
): Promise<AnalyticsEvaluationReport> {
  const planner = createAnalyticsPlanner({ now: () => FIXED_NOW });
  const results: AnalyticsEvaluationCaseResult[] = [];

  for (const evaluationCase of cases) {
    results.push(await evaluateCase(planner, evaluationCase));
  }

  const passed = results.filter((result) => result.planPassed && result.executionPassed).length;
  const total = results.length;

  return {
    score: total === 0 ? 1 : passed / total,
    passed,
    total,
    cases: results,
    failures: results
      .filter((result) => !result.planPassed || !result.executionPassed)
      .map(({ id, diagnostics }) => ({ id, diagnostics })),
  };
}

async function evaluateCase(
  planner: ReturnType<typeof createAnalyticsPlanner>,
  evaluationCase: AnalyticsEvaluationCase,
): Promise<AnalyticsEvaluationCaseResult> {
  const planDiagnostics: string[] = [];
  const executionDiagnostics: string[] = [];
  const currentPlan = 'currentPlan' in evaluationCase ? evaluationCase.currentPlan : undefined;
  const planningResult = await planner.plan({
    question: evaluationCase.question,
    timezone: 'Pacific/Auckland',
    today: '2026-07-19',
    ...(currentPlan ? { currentPlan } : {}),
  });

  if ('expectedStatus' in evaluationCase) {
    compareValue('status', planningResult.status, evaluationCase.expectedStatus, planDiagnostics);
  } else if (planningResult.status !== 'ready') {
    planDiagnostics.push(`planner returned ${planningResult.status}`);
  } else {
    comparePlan(planningResult.plan, evaluationCase.expectedPlan, planDiagnostics);
    if (evaluationCase.expectedRows) {
      const execution = await executeAnalyticsPlan(
        EVALUATION_BUSINESS_ID,
        planningResult.plan,
        evaluationDataSource,
        { now: () => FIXED_NOW },
      );
      compareValue('rows', execution.table.rows, evaluationCase.expectedRows, executionDiagnostics);
    }
  }

  return {
    id: evaluationCase.id,
    planPassed: planDiagnostics.length === 0,
    executionPassed: executionDiagnostics.length === 0,
    diagnostics: [...planDiagnostics, ...executionDiagnostics],
  };
}

function comparePlan(actual: AnalyticsPlan, expected: ExpectedPlan, diagnostics: string[]): void {
  compareValue('metrics', actual.metrics, expected.metrics, diagnostics);
  compareValue('dimensions', actual.dimensions, expected.dimensions, diagnostics);
  compareValue('chart.type', actual.chart.type, expected.chartType, diagnostics);
  if (expected.limit !== undefined)
    compareValue('limit', actual.limit, expected.limit, diagnostics);
  if (expected.dateRange) {
    const { from, to } = actual.dateRange;
    compareValue('dateRange', { from, to }, expected.dateRange, diagnostics);
  }
}

function compareValue(
  field: string,
  actual: unknown,
  expected: unknown,
  diagnostics: string[],
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diagnostics.push(
      `${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

const evaluationDataSource: AnalyticsDataSource = {
  async load(query) {
    if (query.businessId !== EVALUATION_BUSINESS_ID) {
      throw new Error('Evaluation query escaped its trusted business scope');
    }

    return {
      orders: EVALUATION_DATASET.orders.filter(
        (order) => order.orderDate >= query.from && order.orderDate <= query.to,
      ),
      products: EVALUATION_DATASET.products,
    };
  },
};

const hoodie = {
  id: 'product-hoodie',
  sku: 'HD-001',
  name: 'Premium Hoodie',
  category: 'Apparel',
  vendor: 'Northwind',
  currentStock: 4,
  lastSoldAt: new Date('2026-07-18T00:00:00.000Z'),
};

const tote = {
  id: 'product-tote',
  sku: 'TB-001',
  name: 'Everyday Tote',
  category: 'Accessories',
  vendor: 'Northwind',
  currentStock: 20,
  lastSoldAt: new Date('2026-07-10T00:00:00.000Z'),
};

const candle = {
  id: 'product-candle',
  sku: 'CN-001',
  name: 'Soy Candle',
  category: 'Homeware',
  vendor: 'Kauri Goods',
  currentStock: 9,
  lastSoldAt: new Date('2026-03-01T00:00:00.000Z'),
};

const EVALUATION_DATASET: AnalyticsSourceDataset = {
  products: [
    { ...hoodie, recentUnitsSold: 12 },
    { ...tote, recentUnitsSold: 2 },
    { ...candle, recentUnitsSold: 0 },
  ],
  orders: [
    {
      id: 'order-0',
      orderDate: new Date('2026-06-20T12:00:00.000Z'),
      channel: 'TRADE_ME',
      items: [{ quantity: 1, totalPrice: 50, costPrice: 30, product: hoodie }],
    },
    {
      id: 'order-1',
      orderDate: new Date('2026-07-01T12:00:00.000Z'),
      channel: 'SHOPIFY',
      items: [{ quantity: 2, totalPrice: 100, costPrice: 30, product: hoodie }],
    },
    {
      id: 'order-2',
      orderDate: new Date('2026-07-02T12:00:00.000Z'),
      channel: 'IN_STORE',
      items: [{ quantity: 1, totalPrice: 50, costPrice: 20, product: tote }],
    },
    {
      id: 'order-3',
      orderDate: new Date('2026-07-15T12:00:00.000Z'),
      channel: 'SHOPIFY',
      items: [{ quantity: 1, totalPrice: 40, costPrice: 20, product: tote }],
    },
  ],
};
