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
};

export type AnalyticsEvaluationCase = {
  id: string;
  question: string;
  expectedPlan: ExpectedPlan;
  expectedRows: Array<Record<string, string | number | null>>;
};

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

const FIXED_NOW = new Date('2026-07-19T12:00:00.000Z');
const EVALUATION_BUSINESS_ID = 'analytics-evaluation-business';

export const ANALYTICS_EVALUATION_CASES: AnalyticsEvaluationCase[] = [
  {
    id: 'daily-revenue-current-month',
    question: 'Show daily revenue this month',
    expectedPlan: {
      metrics: ['revenue'],
      dimensions: ['day'],
      chartType: 'line',
    },
    expectedRows: [
      { day: '2026-07-01', revenue: 100 },
      { day: '2026-07-02', revenue: 50 },
    ],
  },
  {
    id: 'top-products-by-revenue',
    question: 'Top 2 products by revenue this month',
    expectedPlan: {
      metrics: ['revenue'],
      dimensions: ['product'],
      chartType: 'bar',
      limit: 2,
    },
    expectedRows: [
      { product: 'Premium Hoodie', revenue: 100 },
      { product: 'Everyday Tote', revenue: 50 },
    ],
  },
  {
    id: 'channel-gross-margin',
    question: 'Gross margin by channel this month',
    expectedPlan: {
      metrics: ['grossMarginPct'],
      dimensions: ['channel'],
      chartType: 'bar',
    },
    expectedRows: [
      { channel: 'IN_STORE', grossMarginPct: 60 },
      { channel: 'SHOPIFY', grossMarginPct: 40 },
    ],
  },
  {
    id: 'low-stock-by-category',
    question: 'Low stock by category',
    expectedPlan: {
      metrics: ['lowStockProducts'],
      dimensions: ['category'],
      chartType: 'bar',
    },
    expectedRows: [
      { category: 'Apparel', lowStockProducts: 1 },
      { category: 'Accessories', lowStockProducts: 0 },
    ],
  },
];

export async function runDeterministicAnalyticsEvaluation(
  cases: AnalyticsEvaluationCase[] = ANALYTICS_EVALUATION_CASES,
): Promise<AnalyticsEvaluationReport> {
  const planner = createAnalyticsPlanner({ now: () => FIXED_NOW });
  const results: AnalyticsEvaluationCaseResult[] = [];

  for (const evaluationCase of cases) {
    const planDiagnostics: string[] = [];
    const executionDiagnostics: string[] = [];
    const planningResult = await planner.plan({
      question: evaluationCase.question,
      timezone: 'Pacific/Auckland',
      today: '2026-07-19',
    });

    if (planningResult.status !== 'ready') {
      planDiagnostics.push(`planner returned ${planningResult.status}`);
    } else {
      comparePlan(planningResult.plan, evaluationCase.expectedPlan, planDiagnostics);

      const execution = await executeAnalyticsPlan(
        EVALUATION_BUSINESS_ID,
        planningResult.plan,
        evaluationDataSource,
        { now: () => FIXED_NOW },
      );
      compareValue('rows', execution.table.rows, evaluationCase.expectedRows, executionDiagnostics);
    }

    results.push({
      id: evaluationCase.id,
      planPassed: planDiagnostics.length === 0,
      executionPassed: executionDiagnostics.length === 0 && planningResult.status === 'ready',
      diagnostics: [...planDiagnostics, ...executionDiagnostics],
    });
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

function comparePlan(actual: AnalyticsPlan, expected: ExpectedPlan, diagnostics: string[]): void {
  compareValue('metrics', actual.metrics, expected.metrics, diagnostics);
  compareValue('dimensions', actual.dimensions, expected.dimensions, diagnostics);
  compareValue('chart.type', actual.chart.type, expected.chartType, diagnostics);
  if (expected.limit !== undefined)
    compareValue('limit', actual.limit, expected.limit, diagnostics);
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

const EVALUATION_DATASET: AnalyticsSourceDataset = {
  products: [
    { ...hoodie, recentUnitsSold: 12 },
    { ...tote, recentUnitsSold: 2 },
  ],
  orders: [
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
  ],
};
