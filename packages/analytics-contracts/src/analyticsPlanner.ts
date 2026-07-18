import { z } from 'zod';
import {
  ANALYTICS_DIMENSION_IDS,
  ANALYTICS_FILTER_FIELD_IDS,
  ANALYTICS_FILTER_OPERATORS,
  ANALYTICS_METRIC_IDS,
  ANALYTICS_PLAN_LIMITS,
  ANALYTICS_TIMEZONES,
} from './catalog';
import { analyticsPlanSchema } from './analyticsPlan';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const messageSchema = z.string().trim().min(1).max(320);
const examplesSchema = z.array(z.string().trim().min(1).max(120)).min(1).max(3);

function isValidDateOnly(value: string): boolean {
  if (!dateOnlyPattern.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const analyticsPlannerRequestSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
    timezone: z.enum(ANALYTICS_TIMEZONES).default('Pacific/Auckland'),
    today: z.string().refine(isValidDateOnly, 'Expected a valid ISO calendar date').optional(),
  })
  .strict();

const readyPlannerOutputSchema = z
  .object({
    status: z.literal('ready'),
    plan: analyticsPlanSchema,
    message: messageSchema,
  })
  .strict();

const guidancePlannerOutputSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('clarification'),
      message: messageSchema,
      examples: examplesSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('unsupported'),
      message: messageSchema,
      examples: examplesSchema,
    })
    .strict(),
]);

export const analyticsPlannerOutputSchema = z.union([
  readyPlannerOutputSchema,
  guidancePlannerOutputSchema,
]);

export type AnalyticsPlannerRequest = z.infer<typeof analyticsPlannerRequestSchema>;
export type AnalyticsPlannerOutput = z.infer<typeof analyticsPlannerOutputSchema>;
export type AnalyticsPlannerSource = 'local' | 'provider';
export type AnalyticsPlanningResult = AnalyticsPlannerOutput & { source: AnalyticsPlannerSource };

export function parseAnalyticsPlannerRequest(input: unknown): AnalyticsPlannerRequest {
  return analyticsPlannerRequestSchema.parse(input);
}

export function parseAnalyticsPlannerOutput(input: unknown): AnalyticsPlannerOutput {
  return analyticsPlannerOutputSchema.parse(input);
}

const stringListSchema = {
  type: 'array',
  minItems: 1,
  maxItems: ANALYTICS_PLAN_LIMITS.maxFilterValues,
  items: { type: 'string', minLength: 1, maxLength: 120 },
} as const;

const planJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'metrics',
    'dimensions',
    'dateRange',
    'filters',
    'sort',
    'limit',
    'chart',
  ],
  properties: {
    schemaVersion: { const: 1 },
    metrics: {
      type: 'array',
      minItems: 1,
      maxItems: ANALYTICS_PLAN_LIMITS.maxMetrics,
      uniqueItems: true,
      items: { type: 'string', enum: ANALYTICS_METRIC_IDS },
    },
    dimensions: {
      type: 'array',
      maxItems: ANALYTICS_PLAN_LIMITS.maxDimensions,
      uniqueItems: true,
      items: { type: 'string', enum: ANALYTICS_DIMENSION_IDS },
    },
    dateRange: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'to', 'timezone'],
      properties: {
        from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        timezone: { type: 'string', enum: ANALYTICS_TIMEZONES },
      },
    },
    filters: {
      type: 'array',
      maxItems: ANALYTICS_PLAN_LIMITS.maxFilters,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'operator', 'value'],
        properties: {
          field: { type: 'string', enum: ANALYTICS_FILTER_FIELD_IDS },
          operator: { type: 'string', enum: ANALYTICS_FILTER_OPERATORS },
          value: {
            oneOf: [
              { type: 'string', minLength: 1, maxLength: 120 },
              { type: 'number', minimum: 0 },
              stringListSchema,
            ],
          },
        },
      },
    },
    sort: {
      type: 'array',
      maxItems: ANALYTICS_PLAN_LIMITS.maxSorts,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'direction'],
        properties: {
          field: {
            type: 'string',
            enum: [...ANALYTICS_METRIC_IDS, ...ANALYTICS_DIMENSION_IDS],
          },
          direction: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
    },
    limit: { type: 'integer', minimum: 1, maximum: ANALYTICS_PLAN_LIMITS.maxRows },
    chart: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: { type: { type: 'string', enum: ['line', 'bar', 'donut', 'table'] } },
    },
  },
} as const;

const guidanceProperties = {
  message: { type: 'string', minLength: 1, maxLength: 320 },
  examples: {
    type: 'array',
    minItems: 1,
    maxItems: 3,
    items: { type: 'string', minLength: 1, maxLength: 120 },
  },
} as const;

export const ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'plan', 'message'],
      properties: {
        status: { const: 'ready' },
        plan: planJsonSchema,
        message: guidanceProperties.message,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'message', 'examples'],
      properties: {
        status: { const: 'clarification' },
        ...guidanceProperties,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'message', 'examples'],
      properties: {
        status: { const: 'unsupported' },
        ...guidanceProperties,
      },
    },
  ],
} as const;
