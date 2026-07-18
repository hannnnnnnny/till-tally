import { Play, ShieldCheck } from 'lucide-react';
import { type FormEvent } from 'react';
import { InlineNotice } from '../ui/StatePanel';
import { getActionClassName } from '../ui/layout';
import {
  ANALYTICS_CHART_OPTIONS,
  ANALYTICS_DIMENSION_OPTIONS,
  ANALYTICS_METRIC_OPTIONS,
  ANALYTICS_TIMEZONE_OPTIONS,
} from './plan';
import {
  type AnalyticsChartType,
  type AnalyticsDimensionId,
  type AnalyticsMetricId,
  type AnalyticsPlan,
  type AnalyticsTimezone,
} from './types';

type PlanReviewPanelProps = {
  disabled: boolean;
  errors: string[];
  message: string;
  onChange: (plan: AnalyticsPlan) => void;
  onRun: () => void;
  plan: AnalyticsPlan;
  source: 'local' | 'provider';
};

const CONTROL_CLASS =
  'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export function PlanReviewPanel({
  disabled,
  errors,
  message,
  onChange,
  onRun,
  plan,
  source,
}: PlanReviewPanelProps) {
  const runDisabled = disabled || errors.length > 0;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!runDisabled) {
      onRun();
    }
  }

  function updateMetrics(index: number, value: string): void {
    const slots: Array<AnalyticsMetricId | ''> = [
      plan.metrics[0] ?? '',
      plan.metrics[1] ?? '',
      plan.metrics[2] ?? '',
    ];
    slots[index] = value as AnalyticsMetricId | '';
    const metrics = slots.filter((metric): metric is AnalyticsMetricId => metric !== '');
    onChange(clearUnavailableSort({ ...plan, metrics }));
  }

  function updateDimensions(index: number, value: string): void {
    const slots: Array<AnalyticsDimensionId | ''> = [
      plan.dimensions[0] ?? '',
      plan.dimensions[1] ?? '',
    ];
    slots[index] = value as AnalyticsDimensionId | '';
    const dimensions = slots.filter(
      (dimension): dimension is AnalyticsDimensionId => dimension !== '',
    );
    onChange(clearUnavailableSort({ ...plan, dimensions }));
  }

  return (
    <form
      onSubmit={submit}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">
              {source === 'provider' ? 'AI-assisted draft' : 'Built-in interpretation'}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">Review before running</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Read-only analysis
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      </div>

      <div className="grid gap-x-4 gap-y-5 px-4 py-5 sm:grid-cols-2 sm:px-5">
        {[0, 1, 2].map((index) => (
          <label key={index} className="block text-sm font-semibold text-slate-700">
            Metric {index + 1}
            <select
              value={plan.metrics[index] ?? ''}
              onChange={(event) => updateMetrics(index, event.target.value)}
              disabled={disabled}
              required={index === 0}
              className={`mt-1.5 ${CONTROL_CLASS}`}
            >
              {index > 0 && <option value="">None</option>}
              {ANALYTICS_METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        {[0, 1].map((index) => (
          <label key={index} className="block text-sm font-semibold text-slate-700">
            {index === 0 ? 'Group by' : 'Then by'}
            <select
              value={plan.dimensions[index] ?? ''}
              onChange={(event) => updateDimensions(index, event.target.value)}
              disabled={disabled}
              className={`mt-1.5 ${CONTROL_CLASS}`}
            >
              <option value="">No grouping</option>
              {ANALYTICS_DIMENSION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label className="block text-sm font-semibold text-slate-700">
          Start date
          <input
            type="date"
            value={plan.dateRange.from}
            onChange={(event) =>
              onChange({
                ...plan,
                dateRange: { ...plan.dateRange, from: event.target.value },
              })
            }
            disabled={disabled}
            required
            className={`mt-1.5 ${CONTROL_CLASS}`}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          End date
          <input
            type="date"
            value={plan.dateRange.to}
            onChange={(event) =>
              onChange({ ...plan, dateRange: { ...plan.dateRange, to: event.target.value } })
            }
            disabled={disabled}
            required
            className={`mt-1.5 ${CONTROL_CLASS}`}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Timezone
          <select
            value={plan.dateRange.timezone}
            onChange={(event) =>
              onChange({
                ...plan,
                dateRange: {
                  ...plan.dateRange,
                  timezone: event.target.value as AnalyticsTimezone,
                },
              })
            }
            disabled={disabled}
            className={`mt-1.5 ${CONTROL_CLASS}`}
          >
            {ANALYTICS_TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Visual
          <select
            value={plan.chart.type}
            onChange={(event) =>
              onChange({ ...plan, chart: { type: event.target.value as AnalyticsChartType } })
            }
            disabled={disabled}
            className={`mt-1.5 ${CONTROL_CLASS}`}
          >
            {ANALYTICS_CHART_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Row limit
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            inputMode="numeric"
            value={plan.limit}
            onChange={(event) => onChange({ ...plan, limit: Number(event.target.value) })}
            disabled={disabled}
            required
            className={`mt-1.5 ${CONTROL_CLASS}`}
          />
        </label>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Applied filters</p>
        {plan.filters.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Applied filters">
            {plan.filters.map((filter, index) => (
              <li
                key={`${filter.field}-${index}`}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                {formatFilter(filter.field, filter.operator, filter.value)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-600">No extra filters</p>
        )}

        {errors.length > 0 && (
          <InlineNotice tone="error" className="mt-4">
            <p className="font-semibold">Review these fields</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </InlineNotice>
        )}

        <button
          type="submit"
          disabled={runDisabled}
          className={getActionClassName('primary', 'mt-4 min-h-11 w-full sm:w-auto')}
        >
          <Play aria-hidden="true" className="h-4 w-4" />
          Run analysis
        </button>
      </div>
    </form>
  );
}

function clearUnavailableSort(plan: AnalyticsPlan): AnalyticsPlan {
  const selectedFields = new Set<string>([...plan.metrics, ...plan.dimensions]);
  return {
    ...plan,
    sort: plan.sort.filter(({ field }) => selectedFields.has(field)),
  };
}

function formatFilter(field: string, operator: string, value: string | number | string[]): string {
  const fieldLabel = field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase());
  const operatorLabel: Record<string, string> = {
    contains: 'contains',
    eq: 'equals',
    gte: 'at least',
    in: 'is one of',
    lte: 'at most',
    notIn: 'excludes',
  };
  const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
  return `${fieldLabel} ${operatorLabel[operator] ?? operator} ${displayValue}`;
}
