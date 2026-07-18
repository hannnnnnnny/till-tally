import { createHash, randomBytes } from 'node:crypto';
import type { AnalyticsPlan, AnalyticsPlannerSource } from '@till-tally/analytics-contracts';

export type AnalyticsAuditEvent = 'analytics.plan' | 'analytics.execute';
export type AnalyticsAuditOutcome = 'success' | 'rejected' | 'failure';

export type AnalyticsAuditInput = {
  event: AnalyticsAuditEvent;
  outcome: AnalyticsAuditOutcome;
  durationMs: number;
  userId?: string;
  businessId?: string;
  code?: string;
  source?: AnalyticsPlannerSource;
  plan?: AnalyticsPlan;
};

export type AnalyticsAuditRecorder = {
  record(input: AnalyticsAuditInput): void;
};

type AnalyticsAuditOptions = {
  fingerprintSalt?: string;
  write?: (record: Record<string, unknown>) => void;
};

export function createAnalyticsAuditRecorder(
  options: AnalyticsAuditOptions = {},
): AnalyticsAuditRecorder {
  const fingerprintSalt = options.fingerprintSalt ?? randomBytes(32).toString('hex');
  const write = options.write ?? ((record) => console.info(JSON.stringify(record)));

  return {
    record(input) {
      const record: Record<string, unknown> = {
        event: input.event,
        outcome: input.outcome,
        durationMs: normalizeDuration(input.durationMs),
      };

      if (input.code) record.code = input.code;
      if (input.source) record.source = input.source;
      if (input.userId) record.actor = fingerprint(input.userId, fingerprintSalt);
      if (input.businessId) record.business = fingerprint(input.businessId, fingerprintSalt);
      if (input.plan) record.plan = createSafePlanMetadata(input.plan);

      write(record);
    },
  };
}

function createSafePlanMetadata(plan: AnalyticsPlan): Record<string, unknown> {
  return {
    schemaVersion: plan.schemaVersion,
    metrics: [...plan.metrics],
    dimensions: [...plan.dimensions],
    dateRangeDays: inclusiveDateRangeDays(plan.dateRange.from, plan.dateRange.to),
    filterCount: plan.filters.length,
    sortCount: plan.sort.length,
    limit: plan.limit,
    chartType: plan.chart.type,
  };
}

function fingerprint(value: string, salt: string): string {
  return createHash('sha256').update(salt).update('\0').update(value).digest('hex').slice(0, 16);
}

function normalizeDuration(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function inclusiveDateRangeDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
}

export const analyticsAudit = createAnalyticsAuditRecorder();
