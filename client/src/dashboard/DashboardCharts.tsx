import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';
import {
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
  buildChannelChartData,
  buildSalesTrendChartData,
  formatChartCurrency,
  formatChartDate,
  formatCompactCurrency,
  toggleSalesSeries,
  toggleSelectedChannel,
  type SalesSeriesKey,
} from './charts';
import {
  type ChannelBreakdownResult,
  type ChannelChartDatum,
  type DashboardSalesChannel,
  type SalesTrendChartPoint,
  type SalesTrendResult,
} from './types';

type ChartView = 'chart' | 'table';

type SalesTrendChartProps = {
  data: SalesTrendResult;
};

type ChannelPieChartProps = {
  data: ChannelBreakdownResult;
};

type TooltipEntry<T> = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  payload?: T;
  value?: string | number;
};

type TooltipContentProps<T> = {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry<T>>;
};

const SERIES_CONFIG: Record<SalesSeriesKey, { color: string; label: string }> = {
  sales: { color: '#2563eb', label: 'Revenue' },
  grossProfit: { color: '#059669', label: 'Gross profit' },
};

const countFormatter = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 0 });

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const chartData = buildSalesTrendChartData(data);
  const [view, setView] = useState<ChartView>('chart');
  const [visibleSeries, setVisibleSeries] = useState<SalesSeriesKey[]>(['sales', 'grossProfit']);

  if (chartData.length === 0) {
    return <ChartEmptyState message="No sales found for this date range." />;
  }

  const firstPoint = chartData[0];
  const lastPoint = chartData[chartData.length - 1];
  const rangeDescription = `${formatChartDate(firstPoint.date)} to ${formatChartDate(lastPoint.date)}`;

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">NZD by {data.interval}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Visible trend series">
            {(Object.keys(SERIES_CONFIG) as SalesSeriesKey[]).map((series) => {
              const config = SERIES_CONFIG[series];
              const isVisible = visibleSeries.includes(series);

              return (
                <button
                  key={series}
                  type="button"
                  aria-pressed={isVisible}
                  onClick={() => setVisibleSeries((current) => toggleSalesSeries(current, series))}
                  className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                    isVisible
                      ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: config.color }}
                    aria-hidden="true"
                  />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        <ChartViewSwitch view={view} onChange={setView} label="Sales trend view" />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {chartData.length} {data.interval === 'day' ? 'daily' : 'weekly'} points -{' '}
        {rangeDescription}
      </p>

      {view === 'chart' ? (
        <div
          className="mt-3 h-72 min-h-72"
          role="img"
          aria-label={`Revenue and gross profit trend in New Zealand dollars from ${rangeDescription}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{ bottom: 8, left: 0, right: 8, top: 8 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={24}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                width={56}
                tickFormatter={formatCompactCurrency}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} content={<SalesTooltip />} />
              {visibleSeries.includes('sales') && (
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Revenue"
                  stroke={SERIES_CONFIG.sales.color}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              )}
              {visibleSeries.includes('grossProfit') && (
                <Line
                  type="monotone"
                  dataKey="grossProfit"
                  name="Gross profit"
                  stroke={SERIES_CONFIG.grossProfit.color}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <SalesTrendTable data={chartData} visibleSeries={visibleSeries} />
      )}
    </div>
  );
}

export function ChannelPieChart({ data }: ChannelPieChartProps) {
  const chartData = buildChannelChartData(data);
  const [view, setView] = useState<ChartView>('chart');
  const [selectedChannel, setSelectedChannel] = useState<DashboardSalesChannel | null>(null);

  if (chartData.length === 0) {
    return <ChartEmptyState message="No positive channel revenue found for this date range." />;
  }

  const activeChannel = chartData.some((channel) => channel.channel === selectedChannel)
    ? selectedChannel
    : null;

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Revenue share - NZD</p>
          <p className="mt-1 text-xs text-slate-500">
            Select a channel to isolate its contribution.
          </p>
        </div>
        <ChartViewSwitch view={view} onChange={setView} label="Channel revenue view" />
      </div>

      {view === 'chart' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
          <div
            className="h-72 min-h-72"
            role="img"
            aria-label="Channel revenue share in New Zealand dollars"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="56%"
                  outerRadius="82%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {chartData.map((channel) => {
                    const isSelected = activeChannel === channel.channel;
                    const isMuted = activeChannel !== null && !isSelected;

                    return (
                      <Cell
                        key={channel.channel}
                        fill={channel.color}
                        fillOpacity={isMuted ? 0.24 : 1}
                        stroke={isSelected ? '#0f172a' : '#ffffff'}
                        strokeWidth={isSelected ? 3 : 1}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<ChannelTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ChannelLegend
            data={chartData}
            selectedChannel={activeChannel}
            onSelect={(channel) =>
              setSelectedChannel((current) => toggleSelectedChannel(current, channel))
            }
          />
        </div>
      ) : (
        <ChannelDataTable data={chartData} selectedChannel={activeChannel} />
      )}
    </div>
  );
}

function ChartViewSwitch({
  label,
  onChange,
  view,
}: {
  label: string;
  onChange: (view: ChartView) => void;
  view: ChartView;
}) {
  return (
    <div
      className="grid h-10 w-full grid-cols-2 rounded-md bg-slate-100 p-1 sm:w-44"
      role="group"
      aria-label={label}
    >
      <ChartViewButton
        active={view === 'chart'}
        icon={BarChart3}
        label="Chart"
        onClick={() => onChange('chart')}
      />
      <ChartViewButton
        active={view === 'table'}
        icon={Table2}
        label="Table"
        onClick={() => onChange('table')}
      />
    </div>
  );
}

function ChartViewButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof BarChart3;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-600 ${
        active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SalesTrendTable({
  data,
  visibleSeries,
}: {
  data: SalesTrendChartPoint[];
  visibleSeries: SalesSeriesKey[];
}) {
  return (
    <div className="mt-3 h-72 min-h-72 overflow-auto rounded-md border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">Sales trend values in New Zealand dollars</caption>
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold text-slate-600">
              Date
            </th>
            {visibleSeries.includes('sales') && (
              <th scope="col" className="px-3 py-2.5 text-right font-semibold text-slate-600">
                Revenue
              </th>
            )}
            {visibleSeries.includes('grossProfit') && (
              <th scope="col" className="px-3 py-2.5 text-right font-semibold text-slate-600">
                Gross profit
              </th>
            )}
            <th scope="col" className="px-3 py-2.5 text-right font-semibold text-slate-600">
              Orders
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900">
                {formatChartDate(point.date)}
              </th>
              {visibleSeries.includes('sales') && (
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                  {formatChartCurrency(point.sales)}
                </td>
              )}
              {visibleSeries.includes('grossProfit') && (
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                  {formatChartCurrency(point.grossProfit)}
                </td>
              )}
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                {countFormatter.format(point.orders)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChannelLegend({
  data,
  onSelect,
  selectedChannel,
}: {
  data: ChannelChartDatum[];
  onSelect: (channel: DashboardSalesChannel) => void;
  selectedChannel: DashboardSalesChannel | null;
}) {
  return (
    <div className="space-y-1" role="group" aria-label="Select a channel">
      {data.map((channel) => {
        const isSelected = selectedChannel === channel.channel;
        const isMuted = selectedChannel !== null && !isSelected;

        return (
          <button
            key={channel.channel}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(channel.channel)}
            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
              isSelected
                ? 'border-slate-400 bg-slate-50 shadow-sm'
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
            } ${isMuted ? 'opacity-50' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: channel.color }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {channel.label}
                </span>
                <span className="block text-xs text-slate-500">
                  {countFormatter.format(channel.orders)} orders
                </span>
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold tabular-nums text-slate-900">
                {formatCompactCurrency(channel.value)}
              </span>
              <span className="block text-xs tabular-nums text-slate-500">{channel.share}%</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChannelDataTable({
  data,
  selectedChannel,
}: {
  data: ChannelChartDatum[];
  selectedChannel: DashboardSalesChannel | null;
}) {
  return (
    <div className="mt-3 h-72 min-h-72 overflow-auto rounded-md border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">Channel revenue values in New Zealand dollars</caption>
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            {['Channel', 'Revenue', 'Share', 'Orders', 'AOV'].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-600"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((channel) => (
            <tr
              key={channel.channel}
              className={selectedChannel === channel.channel ? 'bg-blue-50' : undefined}
            >
              <th
                scope="row"
                className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900"
              >
                {channel.label}
              </th>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">
                {formatChartCurrency(channel.value)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">
                {channel.share}%
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">
                {countFormatter.format(channel.orders)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">
                {formatChartCurrency(channel.averageOrderValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalesTooltip({ active, payload }: TooltipContentProps<SalesTrendChartPoint>) {
  const point = payload?.[0]?.payload;

  if (!active || !payload || payload.length === 0 || !point) {
    return null;
  }

  return (
    <div className="min-w-44 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-semibold text-slate-500">{formatChartDate(point.date)}</p>
      <dl className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <dt className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              {String(entry.name)}
            </dt>
            <dd className="font-semibold tabular-nums text-slate-950">
              {formatChartCurrency(Number(entry.value))}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5 text-sm">
          <dt className="text-slate-600">Orders</dt>
          <dd className="font-semibold tabular-nums text-slate-950">
            {countFormatter.format(point.orders)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ChannelTooltip({ active, payload }: TooltipContentProps<ChannelChartDatum>) {
  const channel = payload?.[0]?.payload;

  if (!active || !channel) {
    return null;
  }

  return (
    <div className="min-w-40 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-semibold text-slate-950">{channel.label}</p>
      <dl className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex justify-between gap-4">
          <dt>Revenue</dt>
          <dd className="font-semibold tabular-nums text-slate-950">
            {formatChartCurrency(channel.value)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Share</dt>
          <dd className="font-semibold tabular-nums text-slate-950">{channel.share}%</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Orders</dt>
          <dd className="font-semibold tabular-nums text-slate-950">
            {countFormatter.format(channel.orders)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="mt-5 flex h-72 min-h-72 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600">
      {message}
    </div>
  );
}
