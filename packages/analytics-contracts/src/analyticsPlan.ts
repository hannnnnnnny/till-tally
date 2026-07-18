import { z } from 'zod';
import {
  ANALYTICS_DIMENSION_CATALOG,
  ANALYTICS_DIMENSION_IDS,
  ANALYTICS_FILTER_COMPATIBILITY,
  ANALYTICS_FILTER_FIELD_IDS,
  ANALYTICS_FILTER_OPERATORS,
  ANALYTICS_METRIC_CATALOG,
  ANALYTICS_METRIC_IDS,
  ANALYTICS_PLAN_LIMITS,
  ANALYTICS_TIMEZONES,
  type AnalyticsDimensionId,
  type AnalyticsFilterFieldId,
  type AnalyticsFilterOperator,
  type AnalyticsMetricId,
} from './catalog';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string): boolean {
  if (!dateOnlyPattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const dateOnlySchema = z.string().refine(isValidDateOnly, 'Expected a valid ISO calendar date');

const dateRangeSchema = z
  .object({
    from: dateOnlySchema,
    to: dateOnlySchema,
    timezone: z.enum(ANALYTICS_TIMEZONES),
  })
  .strict()
  .superRefine((range, context) => {
    const from = Date.parse(`${range.from}T00:00:00.000Z`);
    const to = Date.parse(`${range.to}T00:00:00.000Z`);

    if (to < from) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'Date range end must be on or after its start',
      });
      return;
    }

    const inclusiveDays = Math.floor((to - from) / 86_400_000) + 1;
    if (inclusiveDays > ANALYTICS_PLAN_LIMITS.maxDateRangeDays) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: `Date range cannot exceed ${ANALYTICS_PLAN_LIMITS.maxDateRangeDays} days`,
      });
    }
  });

const filterValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().finite().nonnegative(),
  z.array(z.string().trim().min(1).max(120)).min(1).max(ANALYTICS_PLAN_LIMITS.maxFilterValues),
]);

const analyticsFilterSchema = z
  .object({
    field: z.enum(ANALYTICS_FILTER_FIELD_IDS),
    operator: z.enum(ANALYTICS_FILTER_OPERATORS),
    value: filterValueSchema,
  })
  .strict()
  .superRefine((filter, context) => {
    const allowedOperators = ANALYTICS_FILTER_COMPATIBILITY[filter.field];
    if (!allowedOperators.includes(filter.operator)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['operator'],
        message: `${filter.operator} is not supported for ${filter.field}`,
      });
    }

    const expectsList = filter.operator === 'in' || filter.operator === 'notIn';
    if (expectsList !== Array.isArray(filter.value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: expectsList
          ? `${filter.operator} requires a list`
          : `${filter.operator} requires one value`,
      });
    }

    if (filter.field === 'currentStock' && typeof filter.value !== 'number') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'currentStock filters require a non-negative number',
      });
    }

    if (filter.field !== 'currentStock' && typeof filter.value === 'number') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `${filter.field} filters require text values`,
      });
    }
  });

const sortFieldSchema = z.union([z.enum(ANALYTICS_METRIC_IDS), z.enum(ANALYTICS_DIMENSION_IDS)]);

const sortSchema = z
  .object({
    field: sortFieldSchema,
    direction: z.enum(['asc', 'desc']),
  })
  .strict();

const chartSchema = z
  .object({
    type: z.enum(['line', 'bar', 'donut', 'table']),
  })
  .strict();

const inventoryMetricIds = new Set<AnalyticsMetricId>([
  'currentStock',
  'lowStockProducts',
  'stockoutRiskProducts',
  'reorderSoonProducts',
  'slowMoverProducts',
  'deadStockProducts',
  'discountCandidateProducts',
  'overstockedProducts',
]);

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function isMetricDimensionCompatible(
  metric: AnalyticsMetricId,
  dimension: AnalyticsDimensionId,
): boolean {
  const compatibleDimensions: readonly AnalyticsDimensionId[] =
    ANALYTICS_METRIC_CATALOG[metric].compatibleDimensions;

  return compatibleDimensions.includes(dimension);
}

function isInventoryOnlyPlan(metrics: readonly AnalyticsMetricId[]): boolean {
  return metrics.every((metric) => inventoryMetricIds.has(metric));
}

export const analyticsPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    metrics: z.array(z.enum(ANALYTICS_METRIC_IDS)).min(1).max(ANALYTICS_PLAN_LIMITS.maxMetrics),
    dimensions: z.array(z.enum(ANALYTICS_DIMENSION_IDS)).max(ANALYTICS_PLAN_LIMITS.maxDimensions),
    dateRange: dateRangeSchema,
    filters: z.array(analyticsFilterSchema).max(ANALYTICS_PLAN_LIMITS.maxFilters),
    sort: z.array(sortSchema).max(ANALYTICS_PLAN_LIMITS.maxSorts),
    limit: z.number().int().min(1).max(ANALYTICS_PLAN_LIMITS.maxRows),
    chart: chartSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if (hasDuplicates(plan.metrics)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metrics'],
        message: 'Metrics must be unique',
      });
    }

    if (hasDuplicates(plan.dimensions)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dimensions'],
        message: 'Dimensions must be unique',
      });
    }

    for (const [dimensionIndex, dimension] of plan.dimensions.entries()) {
      for (const metric of plan.metrics) {
        if (!isMetricDimensionCompatible(metric, dimension)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dimensions', dimensionIndex],
            message: `${dimension} is not compatible with ${metric}`,
          });
        }
      }
    }

    for (const [sortIndex, sort] of plan.sort.entries()) {
      if (![...plan.metrics, ...plan.dimensions].includes(sort.field)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sort', sortIndex, 'field'],
          message: 'Sort field must be present in the selected result',
        });
      }
    }

    for (const [filterIndex, filter] of plan.filters.entries()) {
      if (filter.field === 'channel' && isInventoryOnlyPlan(plan.metrics)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['filters', filterIndex, 'field'],
          message: 'channel cannot filter inventory-only metrics',
        });
      }
    }

    if (plan.chart.type === 'line') {
      const dimension = plan.dimensions[0];
      if (
        plan.dimensions.length !== 1 ||
        dimension === undefined ||
        ANALYTICS_DIMENSION_CATALOG[dimension].kind !== 'temporal'
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['chart', 'type'],
          message: 'Line charts require exactly one temporal dimension',
        });
      }
    }

    if (plan.chart.type === 'bar' && plan.dimensions.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chart', 'type'],
        message: 'Bar charts require exactly one dimension',
      });
    }

    if (plan.chart.type === 'donut') {
      const dimension = plan.dimensions[0];
      if (
        plan.dimensions.length !== 1 ||
        dimension === undefined ||
        ANALYTICS_DIMENSION_CATALOG[dimension].kind !== 'categorical'
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['chart', 'type'],
          message: 'Donut charts require exactly one categorical dimension',
        });
      }
    }
  });

export type AnalyticsPlan = z.infer<typeof analyticsPlanSchema>;
export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;
export type AnalyticsSort = z.infer<typeof sortSchema>;

export function parseAnalyticsPlan(input: unknown): AnalyticsPlan {
  return analyticsPlanSchema.parse(input);
}

export function isAnalyticsFilterOperatorSupported(
  field: AnalyticsFilterFieldId,
  operator: AnalyticsFilterOperator,
): boolean {
  return ANALYTICS_FILTER_COMPATIBILITY[field].includes(operator);
}
