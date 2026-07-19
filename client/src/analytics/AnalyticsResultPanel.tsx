import {
  BarChart3,
  ChartNoAxesCombined,
  Clock3,
  Database,
  ListFilter,
  PieChart as PieChartIcon,
  Table2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildAnalyticsChartData,
  buildAnalyticsSeriesColors,
  canShowMetricSeries,
  describeAnalyticsFilters,
  describeAnalyticsGrouping,
  describeAnalyticsSort,
  formatAnalyticsDateRange,
  formatAnalyticsDimensionValue,
  formatAnalyticsExecutionTime,
  formatAnalyticsValue,
  formatCompactAnalyticsValue,
  getDefaultVisibleSeries,
  getDonutCompatibleMetrics,
  getInitialVisualization,
  getVisualizationOptions,
  toggleMetricSeries,
  type AnalyticsChartDatum,
  type VisualizationOption,
} from './resultModel';
import {
  type AnalyticsChartType,
  type AnalyticsExecutionResult,
  type AnalyticsMetricId,
} from './types';
import { StatePanel } from '../ui/StatePanel';

type AnalyticsSeries = AnalyticsExecutionResult['chart']['series'][number];

type TooltipEntry = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  payload?: AnalyticsChartDatum;
  value?: string | number | null;
};

type TooltipContentProps = {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
};

const DONUT_COLORS = [
  '#2563eb',
  '#0f766e',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#65a30d',
  '#ea580c',
  '#475569',
  '#be123c',
  '#0f766e',
];

const VIEW_ICONS = {
  line: ChartNoAxesCombined,
  bar: BarChart3,
  donut: PieChartIcon,
  table: Table2,
};

const VIEW_SHORT_LABELS: Record<AnalyticsChartType, string> = {
  line: 'Line',
  bar: 'Bar',
  donut: 'Donut',
  table: 'Table',
};

export function AnalyticsResultPanel({ result }: { result: AnalyticsExecutionResult }) {
  const options = useMemo(() => getVisualizationOptions(result), [result]);
  const chartData = useMemo(() => buildAnalyticsChartData(result), [result]);
  const series = result.chart.series;
  const seriesColors = useMemo(() => buildAnalyticsSeriesColors(series), [series]);
  const donutMetrics = useMemo(() => getDonutCompatibleMetrics(result), [result]);
  const [view, setView] = useState<AnalyticsChartType>(() => getInitialVisualization(result));
  const [visibleSeries, setVisibleSeries] = useState<AnalyticsMetricId[]>(() =>
    getDefaultVisibleSeries(series),
  );
  const [donutMetric, setDonutMetric] = useState<AnalyticsMetricId>(
    donutMetrics[0] ?? result.plan.metrics[0] ?? 'revenue',
  );
  const visibleChartSeries = series.filter(({ key }) => visibleSeries.includes(key));
  const requestedOption = options.find(({ type }) => type === result.chart.type);
  const fallbackMessage =
    view === 'table' && requestedOption && !requestedOption.compatible
      ? `${requestedOption.label} is unavailable: ${requestedOption.reason} Showing the data table instead.`
      : null;
  const incompatibleSummary = options
    .filter(({ compatible }) => !compatible)
    .map(({ label, reason }) => `${label}: ${reason}`)
    .join(' ');

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">Analysis complete</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950 [text-wrap:balance]">
              {result.title}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
            <span>{result.meta.rowCount} rows</span>
            <span aria-hidden="true">/</span>
            <span>{result.meta.durationMs} ms</span>
            {result.meta.truncated && (
              <span className="rounded bg-amber-100 px-2 py-1 font-semibold text-amber-800">
                Showing {result.meta.rowCount} of {result.meta.totalRows}
              </span>
            )}
          </div>
        </div>
      </header>

      <ReportMetadata result={result} />

      <div className="border-y border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <VisualizationSwitch options={options} view={view} onChange={setView} />

          {(view === 'line' || view === 'bar') && series.length > 1 && (
            <SeriesControls
              series={series}
              seriesColors={seriesColors}
              visibleSeries={visibleSeries}
              onToggle={(metric) => {
                setVisibleSeries((current) =>
                  canShowMetricSeries(current, metric, series)
                    ? toggleMetricSeries(current, metric)
                    : current,
                );
              }}
            />
          )}

          {view === 'donut' && donutMetrics.length > 1 && (
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="shrink-0">Donut metric</span>
              <select
                value={donutMetric}
                onChange={(event) => setDonutMetric(event.target.value as AnalyticsMetricId)}
                className="min-h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              >
                {series
                  .filter(({ key }) => donutMetrics.includes(key))
                  .map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        <p id="analytics-view-restrictions" className="sr-only">
          {incompatibleSummary}
        </p>
        {fallbackMessage && (
          <p role="status" className="mt-3 text-xs font-medium leading-5 text-amber-800">
            {fallbackMessage}
          </p>
        )}
      </div>

      {result.table.rows.length === 0 ? (
        <StatePanel
          minHeight="sm"
          className="m-4 sm:m-5"
          title="No matching data"
          message="Try a wider date range or remove a filter from the reviewed plan."
        />
      ) : (
        <div className="min-w-0 px-4 py-5 sm:px-5">
          {view === 'line' && (
            <CartesianAnalyticsChart
              kind="line"
              title={result.title}
              data={chartData}
              series={visibleChartSeries}
              seriesColors={seriesColors}
            />
          )}
          {view === 'bar' && (
            <CartesianAnalyticsChart
              kind="bar"
              title={result.title}
              data={chartData}
              series={visibleChartSeries}
              seriesColors={seriesColors}
            />
          )}
          {view === 'donut' && (
            <AnalyticsDonutChart
              title={result.title}
              data={chartData}
              series={series.find(({ key }) => key === donutMetric)}
            />
          )}
          <AnalyticsDataTable result={result} visuallyHidden={view !== 'table'} />
        </div>
      )}
    </section>
  );
}

function ReportMetadata({ result }: { result: AnalyticsExecutionResult }) {
  const metadata = [
    {
      label: 'Period',
      value: formatAnalyticsDateRange(result.plan.dateRange),
      icon: Clock3,
    },
    {
      label: 'Grouped by',
      value: describeAnalyticsGrouping(result.plan.dimensions),
      icon: Database,
    },
    {
      label: 'Filters',
      value: describeAnalyticsFilters(result.plan.filters),
      icon: ListFilter,
    },
    {
      label: 'Sort',
      value: describeAnalyticsSort(result.plan.sort),
      icon: ChartNoAxesCombined,
    },
  ];

  return (
    <div className="px-4 py-4 sm:px-5" aria-label="Report details">
      <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        {metadata.map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-medium leading-5 text-slate-800">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Generated{' '}
        {formatAnalyticsExecutionTime(result.meta.executedAt, result.plan.dateRange.timezone)} /{' '}
        {result.plan.dateRange.timezone === 'Pacific/Auckland' ? 'Auckland time' : 'UTC'} / Limit{' '}
        {result.plan.limit} rows
      </p>
    </div>
  );
}

function VisualizationSwitch({
  onChange,
  options,
  view,
}: {
  onChange: (view: AnalyticsChartType) => void;
  options: VisualizationOption[];
  view: AnalyticsChartType;
}) {
  return (
    <div
      className="grid min-h-11 w-full grid-cols-4 rounded-md bg-slate-200 p-1 lg:w-[23rem]"
      role="group"
      aria-label="Report view"
    >
      {options.map((option) => {
        const Icon = VIEW_ICONS[option.type];
        const isActive = view === option.type;

        return (
          <button
            key={option.type}
            type="button"
            aria-label={option.label}
            aria-pressed={isActive}
            aria-disabled={!option.compatible}
            aria-describedby={!option.compatible ? 'analytics-view-restrictions' : undefined}
            title={option.reason ?? option.label}
            onClick={() => option.compatible && onChange(option.type)}
            className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded px-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${
              !option.compatible
                ? 'cursor-not-allowed text-slate-400'
                : isActive
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-950'
            }`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{VIEW_SHORT_LABELS[option.type]}</span>
          </button>
        );
      })}
    </div>
  );
}

function SeriesControls({
  onToggle,
  series,
  seriesColors,
  visibleSeries,
}: {
  onToggle: (metric: AnalyticsMetricId) => void;
  series: AnalyticsSeries[];
  seriesColors: Partial<Record<AnalyticsMetricId, string>>;
  visibleSeries: AnalyticsMetricId[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Visible report series">
      {series.map((item) => {
        const isVisible = visibleSeries.includes(item.key);
        const canShow = canShowMetricSeries(visibleSeries, item.key, series);
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={isVisible}
            aria-disabled={!canShow}
            aria-label={`${item.label} series`}
            title={
              canShow ? item.label : 'Hide a series with a different unit before showing this one.'
            }
            onClick={() => canShow && onToggle(item.key)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
              !canShow
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : isVisible
                  ? 'border-slate-300 bg-white text-slate-900'
                  : 'border-slate-200 bg-slate-100 text-slate-500'
            }`}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: seriesColors[item.key] ?? '#64748b' }}
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function CartesianAnalyticsChart({
  data,
  kind,
  series,
  seriesColors,
  title,
}: {
  data: AnalyticsChartDatum[];
  kind: 'line' | 'bar';
  series: AnalyticsSeries[];
  seriesColors: Partial<Record<AnalyticsMetricId, string>>;
  title: string;
}) {
  const units = [...new Set(series.map(({ unit }) => unit))];

  if (!hasNumericValues(data, series)) {
    return <ChartValueEmptyState />;
  }

  const commonChildren = (
    <>
      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="category"
        axisLine={false}
        tickLine={false}
        minTickGap={24}
        tick={{ fill: '#64748b', fontSize: 12 }}
        tickFormatter={shortenAxisLabel}
      />
      {units.map((unit, index) => (
        <YAxis
          key={unit}
          yAxisId={unit}
          orientation={index === 0 ? 'left' : 'right'}
          hide={index > 1}
          width={index > 1 ? 0 : 58}
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickFormatter={(value: number) => formatCompactAnalyticsValue(value, unit)}
        />
      ))}
      <Tooltip content={<AnalyticsChartTooltip series={series} />} />
    </>
  );

  return (
    <div
      className="h-[280px] min-h-[280px] w-full sm:h-80 sm:min-h-80"
      role="img"
      aria-label={`${kind === 'line' ? 'Line' : 'Bar'} chart for ${title}. Use Data table for exact values.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'line' ? (
          <LineChart
            data={data}
            margin={{ top: 12, right: units.length > 1 ? 8 : 4, bottom: 8, left: 0 }}
          >
            {commonChildren}
            {series.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                yAxisId={item.unit}
                stroke={seriesColors[item.key] ?? '#64748b'}
                strokeWidth={2.5}
                dot={data.length <= 12 ? { r: 3 } : false}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart
            data={data}
            margin={{ top: 12, right: units.length > 1 ? 8 : 4, bottom: 8, left: 0 }}
          >
            {commonChildren}
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                yAxisId={item.unit}
                fill={seriesColors[item.key] ?? '#64748b'}
                radius={[3, 3, 0, 0]}
                maxBarSize={46}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function AnalyticsDonutChart({
  data,
  series,
  title,
}: {
  data: AnalyticsChartDatum[];
  series: AnalyticsSeries | undefined;
  title: string;
}) {
  if (!series) {
    return <ChartValueEmptyState />;
  }

  const donutData: Array<{ name: string; value: number }> = [];
  for (const datum of data) {
    const metricValue = datum[series.key];

    if (typeof metricValue !== 'number' || !Number.isFinite(metricValue) || metricValue < 0) {
      return <ChartValueEmptyState />;
    }

    donutData.push({
      name: datum.category,
      value: metricValue,
    });
  }

  if (!donutData.some(({ value }) => value > 0)) {
    return <ChartValueEmptyState />;
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
      <div
        className="h-[280px] min-h-[280px] w-full sm:h-80 sm:min-h-80"
        role="img"
        aria-label={`Donut chart of ${series.label} for ${title}. Use Data table for exact values.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {donutData.map(({ name }, index) => (
                <Cell
                  key={`${name}-${index}`}
                  fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip series={series} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div
        className="max-h-72 space-y-1 overflow-y-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        role="region"
        aria-label={`${series.label} legend`}
        tabIndex={0}
      >
        {donutData.map(({ name, value }, index) => (
          <div
            key={`${name}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span className="truncate font-medium text-slate-700" title={name}>
                {name}
              </span>
            </span>
            <span className="font-semibold tabular-nums text-slate-950">
              {formatAnalyticsValue(value, series.unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsChartTooltip({
  active,
  payload,
  series,
}: TooltipContentProps & { series: AnalyticsSeries[] }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const category = payload[0]?.payload?.category ?? 'Result';

  return (
    <div className="min-w-44 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
      <p className="max-w-64 text-sm font-semibold text-slate-950">{category}</p>
      <dl className="mt-2 space-y-1.5">
        {payload.map((entry) => {
          const item = series.find(({ key }) => key === entry.dataKey);
          if (!item) return null;

          return (
            <div key={item.key} className="flex items-center justify-between gap-4 text-xs">
              <dt className="flex items-center gap-2 text-slate-600">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                {item.label}
              </dt>
              <dd className="font-semibold tabular-nums text-slate-950">
                {formatAnalyticsValue(
                  typeof entry.value === 'number' ? entry.value : null,
                  item.unit,
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function DonutTooltip({
  active,
  payload,
  series,
}: TooltipContentProps & { series: AnalyticsSeries }) {
  const entry = payload?.[0];
  if (!active || !entry) {
    return null;
  }

  return (
    <div className="min-w-40 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-semibold text-slate-950">{String(entry.name ?? 'Result')}</p>
      <p className="mt-1 text-xs text-slate-600">{series.label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
        {formatAnalyticsValue(typeof entry.value === 'number' ? entry.value : null, series.unit)}
      </p>
    </div>
  );
}

function AnalyticsDataTable({
  result,
  visuallyHidden,
}: {
  result: AnalyticsExecutionResult;
  visuallyHidden: boolean;
}) {
  return (
    <div
      role={visuallyHidden ? undefined : 'region'}
      aria-label={visuallyHidden ? undefined : `Exact values for ${result.title}`}
      tabIndex={visuallyHidden ? undefined : 0}
      className={
        visuallyHidden
          ? 'sr-only'
          : 'max-h-[26rem] max-w-full overflow-auto rounded-md border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
      }
    >
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <caption className="sr-only">Exact values for {result.title}</caption>
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
          <tr>
            {result.table.columns.map((column) => (
              <th key={column.key} scope="col" className="whitespace-nowrap px-3 py-3 sm:px-4">
                {column.label}
                {column.unit ? <span className="font-normal"> ({column.unit})</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {result.table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="text-slate-700 hover:bg-slate-50">
              {result.table.columns.map((column, columnIndex) => {
                const dimension = result.plan.dimensions.find((item) => item === column.key);
                const value =
                  column.kind === 'dimension' && dimension
                    ? formatAnalyticsDimensionValue(row[column.key], dimension)
                    : formatAnalyticsValue(row[column.key], column.unit);
                return columnIndex === 0 && column.kind === 'dimension' ? (
                  <th
                    key={column.key}
                    scope="row"
                    className="max-w-64 px-3 py-3 font-semibold text-slate-900 sm:px-4"
                  >
                    {value}
                  </th>
                ) : (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-3 py-3 text-right tabular-nums sm:px-4"
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartValueEmptyState() {
  return (
    <div className="flex h-[280px] min-h-[280px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600 sm:h-80 sm:min-h-80">
      This result has no numeric values to chart. Open the data table to inspect missing values.
    </div>
  );
}

function hasNumericValues(data: AnalyticsChartDatum[], series: AnalyticsSeries[]): boolean {
  return data.some((datum) =>
    series.some(({ key }) => typeof datum[key] === 'number' && Number.isFinite(datum[key])),
  );
}

function shortenAxisLabel(value: string): string {
  return value.length > 14 ? `${value.slice(0, 11)}...` : value;
}
