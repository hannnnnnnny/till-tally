import {
  ANALYTICS_DIMENSION_CATALOG,
  ANALYTICS_METRIC_CATALOG,
  ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA,
  parseAnalyticsPlan,
  parseAnalyticsPlannerOutput,
  parseAnalyticsPlannerRequest,
  type AnalyticsDimensionId,
  type AnalyticsPlan,
  type AnalyticsMetricId,
  type AnalyticsPlannerOutput,
  type AnalyticsPlannerRequest,
  type AnalyticsPlanningResult,
} from '@till-tally/analytics-contracts';

const DEFAULT_PROVIDER_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 1;
const TEMPORAL_DIMENSIONS = new Set<AnalyticsDimensionId>(['day', 'week', 'month']);
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

  if (isUnsupportedRequest(question)) {
    return {
      status: 'unsupported',
      message: 'That request is outside the supported retail analytics catalog.',
      examples: EXAMPLE_QUESTIONS,
    };
  }

  if (request.currentPlan) {
    return refineCurrentPlan(request, request.currentPlan, question, now);
  }

  const metric = detectMetric(question);
  if (!metric) return null;

  const dimension = detectDimension(question);
  const today = request.today ?? formatDateInTimezone(now, request.timezone);
  const draft = {
    schemaVersion: 1,
    metrics: [metric],
    dimensions: dimension ? [dimension] : [],
    dateRange: resolveDateRange(question, today, request.timezone),
    filters: [],
    sort: buildDefaultSort(metric, dimension ?? undefined),
    limit: resolveLimit(question, dimension),
  };
  const plan = parsePlanWithPreferredChart(
    draft,
    detectChartType(question),
    defaultChart(dimension),
  );

  return {
    status: 'ready',
    plan,
    message: `${ANALYTICS_METRIC_CATALOG[metric].label}${
      dimension ? ` by ${ANALYTICS_DIMENSION_CATALOG[dimension].label.toLocaleLowerCase()}` : ''
    } for the selected period.`,
  };
}

function isUnsupportedRequest(question: string): boolean {
  return /customer lifetime value|write (?:sql|javascript|code)|raw sql|weather forecast/.test(
    question,
  );
}

function defaultChart(dimension: AnalyticsDimensionId | null): AnalyticsPlan['chart']['type'] {
  if (!dimension) return 'table';
  return TEMPORAL_DIMENSIONS.has(dimension) ? 'line' : 'bar';
}

function refineCurrentPlan(
  request: AnalyticsPlannerRequest,
  current: AnalyticsPlan,
  question: string,
  now: Date,
): AnalyticsPlannerOutput | null {
  const metric = detectMetric(question) ?? current.metrics[0];
  const dimensions = resolveRefinedDimensions(question, current.dimensions);
  const today = request.today ?? formatDateInTimezone(now, request.timezone);
  const metricChanged = metric !== current.metrics[0];
  const dimensionChanged =
    dimensions.length !== current.dimensions.length ||
    dimensions.some((dimension, index) => dimension !== current.dimensions[index]);

  try {
    const plan = parseAnalyticsPlan({
      ...current,
      metrics: metricChanged ? [metric] : current.metrics,
      dimensions,
      dateRange: resolveExplicitDateRange(question, today, request.timezone) ?? current.dateRange,
      sort:
        metricChanged || dimensionChanged ? buildDefaultSort(metric, dimensions[0]) : current.sort,
      limit: resolveExplicitLimit(question) ?? current.limit,
      chart: { type: detectChartType(question) ?? current.chart.type },
    });

    return {
      status: 'ready',
      plan,
      message: 'Refined the current validated plan while retaining the rest of its settings.',
    };
  } catch {
    // An incompatible refinement falls through to clarification or the optional provider.
    return null;
  }
}

function resolveRefinedDimensions(
  question: string,
  currentDimensions: AnalyticsDimensionId[],
): AnalyticsDimensionId[] {
  if (/\boverall\b|without (?:a )?(?:grouping|breakdown)/.test(question)) return [];
  const detected = detectDimension(question);
  return detected ? [detected] : currentDimensions;
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
  const temporal = TEMPORAL_DIMENSIONS.has(dimension);
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

type PlannerDateRange = {
  from: string;
  to: string;
  timezone: AnalyticsPlannerRequest['timezone'];
};

function resolveDateRange(
  question: string,
  today: string,
  timezone: AnalyticsPlannerRequest['timezone'],
): PlannerDateRange {
  return (
    resolveExplicitDateRange(question, today, timezone) ?? {
      from: shiftDate(today, -29),
      to: today,
      timezone,
    }
  );
}

// Returns null when the question names no period, so callers can keep or default the range.
function resolveExplicitDateRange(
  question: string,
  today: string,
  timezone: AnalyticsPlannerRequest['timezone'],
): PlannerDateRange | null {
  const range = (from: string, to: string): PlannerDateRange => ({ from, to, timezone });
  const lastDays = question.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/);
  const mondayThisWeek = shiftDate(
    today,
    -((new Date(`${today}T00:00:00.000Z`).getUTCDay() + 6) % 7),
  );
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  if (/\byesterday\b/.test(question)) return range(shiftDate(today, -1), shiftDate(today, -1));
  if (/\btoday\b/.test(question)) return range(today, today);
  if (lastDays?.[1]) {
    const days = Math.min(366, Math.max(1, Number(lastDays[1])));
    return range(shiftDate(today, -(days - 1)), today);
  }
  if (/\b(?:last|previous) week\b/.test(question)) {
    return range(shiftDate(mondayThisWeek, -7), shiftDate(mondayThisWeek, -1));
  }
  if (/\b(?:last|previous) month\b/.test(question)) {
    const lastDayOfPreviousMonth = shiftDate(firstOfMonth, -1);
    return range(`${lastDayOfPreviousMonth.slice(0, 7)}-01`, lastDayOfPreviousMonth);
  }
  if (/this week|current week/.test(question)) return range(mondayThisWeek, today);
  if (/this month|current month/.test(question)) return range(firstOfMonth, today);
  return null;
}

function parsePlanWithPreferredChart(
  draft: Record<string, unknown>,
  preferredChart: AnalyticsPlan['chart']['type'] | null,
  defaultChart: AnalyticsPlan['chart']['type'],
): AnalyticsPlan {
  if (preferredChart && preferredChart !== defaultChart) {
    try {
      return parseAnalyticsPlan({ ...draft, chart: { type: preferredChart } });
    } catch {
      // The requested chart does not fit these metrics/dimensions; keep the default instead.
    }
  }

  return parseAnalyticsPlan({ ...draft, chart: { type: defaultChart } });
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
