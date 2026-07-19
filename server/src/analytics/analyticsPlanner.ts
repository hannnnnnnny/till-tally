import {
  ANALYTICS_DIMENSION_CATALOG,
  ANALYTICS_METRIC_CATALOG,
  ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA,
  parseAnalyticsPlan,
  parseAnalyticsPlannerOutput,
  parseAnalyticsPlannerRequest,
  type AnalyticsDimensionId,
  type AnalyticsMetricId,
  type AnalyticsPlannerOutput,
  type AnalyticsPlannerRequest,
  type AnalyticsPlanningResult,
} from '@till-tally/analytics-contracts';

const DEFAULT_PROVIDER_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 1;
const EXAMPLE_QUESTIONS = [
  'Show daily revenue this month',
  'Top 10 products by revenue',
  'Compare gross margin by category',
];

export type AnalyticsPlannerProviderRequest = {
  systemPrompt: string;
  userPrompt: string;
  schema: typeof ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA;
  signal: AbortSignal;
};

export interface AnalyticsPlannerProvider {
  generate(request: AnalyticsPlannerProviderRequest): Promise<string>;
}

export interface AnalyticsPlanner {
  plan(input: unknown, options?: { signal?: AbortSignal }): Promise<AnalyticsPlanningResult>;
}

type PlannerOptions = {
  provider?: AnalyticsPlannerProvider;
  timeoutMs?: number;
  maxRetries?: number;
  now?: () => Date;
};

export function createAnalyticsPlanner(options: PlannerOptions = {}): AnalyticsPlanner {
  const timeoutMs = clampInteger(options.timeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS, 100, 30_000);
  const maxRetries = clampInteger(options.maxRetries, DEFAULT_MAX_RETRIES, 0, 2);
  const now = options.now ?? (() => new Date());

  return {
    async plan(input, planOptions = {}) {
      const request = parseAnalyticsPlannerRequest(input);
      const localResult = planLocally(request, now());
      if (localResult) return { ...localResult, source: 'local' };

      if (!options.provider) return createClarificationResult();

      const providerResult = await requestProviderPlan(
        options.provider,
        request,
        timeoutMs,
        maxRetries,
        planOptions.signal,
      );

      return providerResult ?? createClarificationResult();
    },
  };
}

async function requestProviderPlan(
  provider: AnalyticsPlannerProvider,
  request: AnalyticsPlannerRequest,
  timeoutMs: number,
  maxRetries: number,
  externalSignal: AbortSignal | undefined,
): Promise<AnalyticsPlanningResult | null> {
  const prompt = createProviderPrompt(request);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const output = await generateWithTimeout(provider, prompt, timeoutMs, externalSignal);

      try {
        const parsed = parseAnalyticsPlannerOutput(JSON.parse(output));
        return { ...parsed, source: 'provider' };
      } catch {
        if (attempt === maxRetries) return null;
      }
    } catch (error) {
      if (externalSignal?.aborted) throw externalSignal.reason ?? error;
      return null;
    }
  }

  return null;
}

async function generateWithTimeout(
  provider: AnalyticsPlannerProvider,
  prompt: Pick<AnalyticsPlannerProviderRequest, 'systemPrompt' | 'userPrompt' | 'schema'>,
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
): Promise<string> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(new Error('Analytics planner provider timed out')),
    timeoutMs,
  );
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal;

  try {
    return await provider.generate({ ...prompt, signal });
  } finally {
    clearTimeout(timeout);
  }
}

function createProviderPrompt(
  request: AnalyticsPlannerRequest,
): Pick<AnalyticsPlannerProviderRequest, 'systemPrompt' | 'userPrompt' | 'schema'> {
  const metricCatalog = Object.fromEntries(
    Object.entries(ANALYTICS_METRIC_CATALOG).map(([id, metric]) => [
      id,
      {
        label: metric.label,
        description: metric.description,
        unit: metric.unit,
        compatibleDimensions: metric.compatibleDimensions,
      },
    ]),
  );
  const dimensionCatalog = Object.fromEntries(
    Object.entries(ANALYTICS_DIMENSION_CATALOG).map(([id, dimension]) => [
      id,
      { label: dimension.label, kind: dimension.kind },
    ]),
  );
  const schema = ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA;

  return {
    schema,
    systemPrompt: [
      'You translate retail analytics questions into the supplied strict JSON response schema.',
      'Use only the listed metric and dimension ids. Never emit SQL, JavaScript, database fields, or extra keys.',
      'If essential intent is missing, return clarification. If the catalog cannot answer it, return unsupported.',
      `Metric catalog: ${JSON.stringify(metricCatalog)}`,
      `Dimension catalog: ${JSON.stringify(dimensionCatalog)}`,
      `Output JSON Schema: ${JSON.stringify(schema)}`,
    ].join('\n'),
    userPrompt: JSON.stringify({
      question: request.question,
      timezone: request.timezone,
      today: request.today ?? null,
      currentPlan: request.currentPlan ?? null,
    }),
  };
}

function planLocally(request: AnalyticsPlannerRequest, now: Date): AnalyticsPlannerOutput | null {
  const question = request.question.toLocaleLowerCase();

  if (
    /customer lifetime value|write (?:sql|javascript|code)|raw sql|weather forecast/.test(question)
  ) {
    return {
      status: 'unsupported',
      message: 'That request is outside the supported retail analytics catalog.',
      examples: EXAMPLE_QUESTIONS,
    };
  }

  if (request.currentPlan) {
    return refineCurrentPlan(request, question, now);
  }

  const metric = detectMetric(question);
  if (!metric) return null;

  const dimension = detectDimension(question);
  const today = request.today ?? formatDateInTimezone(now, request.timezone);
  const dateRange = resolveDateRange(question, today, request.timezone);
  const limit = resolveLimit(question, dimension);
  const chartType = dimension
    ? ['day', 'week', 'month'].includes(dimension)
      ? 'line'
      : 'bar'
    : 'table';
  const sort = dimension
    ? [
        {
          field: ['day', 'week', 'month'].includes(dimension) ? dimension : metric,
          direction: ['day', 'week', 'month'].includes(dimension) ? 'asc' : 'desc',
        },
      ]
    : [];

  const plan = parseAnalyticsPlan({
    schemaVersion: 1,
    metrics: [metric],
    dimensions: dimension ? [dimension] : [],
    dateRange,
    filters: [],
    sort,
    limit,
    chart: { type: chartType },
  });

  return {
    status: 'ready',
    plan,
    message: `${ANALYTICS_METRIC_CATALOG[metric].label}${
      dimension ? ` by ${ANALYTICS_DIMENSION_CATALOG[dimension].label.toLocaleLowerCase()}` : ''
    } for the selected period.`,
  };
}

function refineCurrentPlan(
  request: AnalyticsPlannerRequest,
  question: string,
  now: Date,
): AnalyticsPlannerOutput | null {
  if (!request.currentPlan) return null;

  const current = request.currentPlan;
  const metric = detectMetric(question) ?? current.metrics[0];
  const detectedDimension = detectDimension(question);
  const dimensions = /\boverall\b|without (?:a )?(?:grouping|breakdown)/.test(question)
    ? []
    : detectedDimension
      ? [detectedDimension]
      : current.dimensions;
  const today = request.today ?? formatDateInTimezone(now, request.timezone);
  const dateRange = /this month|current month|this week|current week|last 30 days/.test(question)
    ? resolveDateRange(question, today, request.timezone)
    : current.dateRange;
  const explicitLimit = resolveExplicitLimit(question);
  const chartType = detectChartType(question) ?? current.chart.type;
  const metricChanged = metric !== current.metrics[0];
  const dimensionChanged =
    dimensions.length !== current.dimensions.length ||
    dimensions.some((dimension, index) => dimension !== current.dimensions[index]);
  const sort =
    metricChanged || dimensionChanged ? buildDefaultSort(metric, dimensions[0]) : current.sort;

  try {
    const plan = parseAnalyticsPlan({
      ...current,
      metrics: metricChanged ? [metric] : current.metrics,
      dimensions,
      dateRange,
      sort,
      limit: explicitLimit ?? current.limit,
      chart: { type: chartType },
    });

    return {
      status: 'ready',
      plan,
      message: 'Refined the current validated plan while retaining the rest of its settings.',
    };
  } catch {
    return null;
  }
}

function detectChartType(question: string): 'line' | 'bar' | 'donut' | 'table' | null {
  if (/\btable\b|tabular/.test(question)) return 'table';
  if (/\bline(?: chart)?\b/.test(question)) return 'line';
  if (/\bbar(?: chart)?\b/.test(question)) return 'bar';
  if (/\bdonut\b|\bpie(?: chart)?\b/.test(question)) return 'donut';
  return null;
}

function buildDefaultSort(
  metric: AnalyticsMetricId,
  dimension: AnalyticsDimensionId | undefined,
): Array<{ field: AnalyticsMetricId | AnalyticsDimensionId; direction: 'asc' | 'desc' }> {
  if (!dimension) return [];
  const temporal = ['day', 'week', 'month'].includes(dimension);
  return [{ field: temporal ? dimension : metric, direction: temporal ? 'asc' : 'desc' }];
}

function detectMetric(question: string): AnalyticsMetricId | null {
  const candidates: Array<[RegExp, AnalyticsMetricId]> = [
    [/gross margin|margin percentage|margin %/, 'grossMarginPct'],
    [/gross profit/, 'grossProfit'],
    [/average order value|\baov\b/, 'averageOrderValue'],
    [/units sold|sales volume/, 'unitsSold'],
    [/stockout/, 'stockoutRiskProducts'],
    [/reorder/, 'reorderSoonProducts'],
    [/low stock/, 'lowStockProducts'],
    [/slow mover/, 'slowMoverProducts'],
    [/dead stock/, 'deadStockProducts'],
    [/discount candidate/, 'discountCandidateProducts'],
    [/overstock/, 'overstockedProducts'],
    [/current stock|inventory level|stock on hand/, 'currentStock'],
    [/order count|number of orders|\borders\b/, 'orders'],
    [/revenue|\bsales\b/, 'revenue'],
  ];

  return candidates.find(([pattern]) => pattern.test(question))?.[1] ?? null;
}

function detectDimension(question: string): AnalyticsDimensionId | null {
  const candidates: Array<[RegExp, AnalyticsDimensionId]> = [
    [/\bdaily\b|by day|sales trend|revenue trend/, 'day'],
    [/\bweekly\b|by week/, 'week'],
    [/\bmonthly\b|by month/, 'month'],
    [/\bproducts?\b|by sku/, 'product'],
    [/\bcategor(?:y|ies)\b/, 'category'],
    [/\bchannels?\b/, 'channel'],
    [/\bstatus\b|risk type/, 'status'],
  ];

  return candidates.find(([pattern]) => pattern.test(question))?.[1] ?? null;
}

function resolveDateRange(
  question: string,
  today: string,
  timezone: AnalyticsPlannerRequest['timezone'],
): { from: string; to: string; timezone: AnalyticsPlannerRequest['timezone'] } {
  if (/this month|current month/.test(question)) {
    return { from: `${today.slice(0, 7)}-01`, to: today, timezone };
  }

  if (/this week|current week/.test(question)) {
    const date = new Date(`${today}T00:00:00.000Z`);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    return { from: shiftDate(today, -daysSinceMonday), to: today, timezone };
  }

  return { from: shiftDate(today, -29), to: today, timezone };
}

function resolveLimit(question: string, dimension: AnalyticsDimensionId | null): number {
  const explicitLimit = resolveExplicitLimit(question);
  if (explicitLimit !== null) return explicitLimit;
  return dimension ? 31 : 1;
}

function resolveExplicitLimit(question: string): number | null {
  const topMatch = question.match(/\btop\s+(\d{1,3})\b/);
  return topMatch?.[1] ? Math.min(100, Math.max(1, Number(topMatch[1]))) : null;
}

function formatDateInTimezone(date: Date, timezone: AnalyticsPlannerRequest['timezone']): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function createClarificationResult(): AnalyticsPlanningResult {
  return {
    status: 'clarification',
    source: 'local',
    message: 'What would you like to measure, and how should it be grouped?',
    examples: EXAMPLE_QUESTIONS,
  };
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value as number));
}
