import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildChannelChartData, buildSalesTrendChartData, formatCompactCurrency } from './charts';
import { type ChannelBreakdownResult, type SalesTrendResult } from './types';

type SalesTrendChartProps = {
  data: SalesTrendResult;
};

type ChannelPieChartProps = {
  data: ChannelBreakdownResult;
};

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const chartData = buildSalesTrendChartData(data);

  if (chartData.length === 0) {
    return <ChartEmptyState message="No sales found for this date range." />;
  }

  return (
    <div className="mt-5 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ bottom: 8, left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
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
          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            formatter={formatSalesTooltipValue}
            labelFormatter={(label) => `Date: ${String(label)}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="sales"
            name="Sales"
            stroke="#2563eb"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="grossProfit"
            name="Gross profit"
            stroke="#059669"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChannelPieChart({ data }: ChannelPieChartProps) {
  const chartData = buildChannelChartData(data);

  if (chartData.length === 0) {
    return <ChartEmptyState message="No channel revenue found for this date range." />;
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="56%"
              outerRadius="82%"
              paddingAngle={2}
            >
              {chartData.map((channel) => (
                <Cell key={channel.channel} fill={channel.color} />
              ))}
            </Pie>
            <Tooltip formatter={formatChannelTooltipValue} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        {chartData.map((channel) => (
          <div key={channel.channel} className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: channel.color }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{channel.label}</p>
                <p className="text-xs text-slate-500">{channel.orders} orders</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">
                {formatCompactCurrency(channel.value)}
              </p>
              <p className="text-xs text-slate-500">{channel.share}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="mt-5 flex h-72 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600">
      {message}
    </div>
  );
}

function formatSalesTooltipValue(value: unknown, name: unknown): [string, string] {
  const metricName = String(name);

  if (metricName === 'Orders') {
    return [String(value), metricName];
  }

  return [formatCompactCurrency(Number(value)), metricName];
}

function formatChannelTooltipValue(value: unknown, name: unknown): [string, string] {
  return [formatCompactCurrency(Number(value)), String(name)];
}
