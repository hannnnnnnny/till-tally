import {
  ArrowRight,
  CircleDollarSign,
  Minus,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusinesses } from '../businesses/BusinessContext';
import {
  fetchDashboardChannelBreakdown,
  fetchDashboardSalesTrend,
  fetchDashboardSummary,
} from '../dashboard/api';
import {
  buildDashboardDecisionSignals,
  buildHeadlineMetrics,
  getDashboardRangeQuery,
  type DashboardDecisionSignal,
  type DashboardHeadlineMetric,
  type DashboardRangeDays,
} from '../dashboard/decisionModel';
import { formatDashboardRange } from '../dashboard/summary';
import {
  type ChannelBreakdownResult,
  type DashboardSummary,
  type SalesTrendResult,
} from '../dashboard/types';
import { fetchInventoryInsights } from '../inventory/api';
import { type InventoryInsights } from '../inventory/types';
import { fetchProductPerformance } from '../products/api';
import { type ProductPerformanceResult } from '../products/types';
import { PageHeader, SectionHeader, Surface } from '../ui/PageLayout';
import { getActionClassName } from '../ui/layout';
import { InlineNotice, MetricSkeletonGrid, StatePanel } from '../ui/StatePanel';

type DashboardSummaryStatus = 'idle' | 'loading' | 'ready' | 'error';

type DashboardData = {
  channelBreakdown: ChannelBreakdownResult;
  inventory: InventoryInsights;
  previousSummary: DashboardSummary;
  products: ProductPerformanceResult;
  salesTrend: SalesTrendResult;
  summary: DashboardSummary;
};

const RANGE_OPTIONS: Array<{ days: DashboardRangeDays; label: string }> = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

const SIGNAL_ICONS: Record<DashboardDecisionSignal['route'], LucideIcon> = {
  '/channels': ShoppingBag,
  '/inventory': Warehouse,
  '/products': PackageSearch,
};

const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  currency: 'NZD',
  style: 'currency',
});

const numberFormatter = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 0 });

const SalesTrendChart = lazy(() =>
  import('../dashboard/DashboardCharts').then((module) => ({
    default: module.SalesTrendChart,
  })),
);

const ChannelPieChart = lazy(() =>
  import('../dashboard/DashboardCharts').then((module) => ({
    default: module.ChannelPieChart,
  })),
);

export function DashboardPage() {
  const { activeBusiness, activeBusinessHeaders, status: businessStatus } = useBusinesses();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<DashboardSummaryStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(30);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!activeBusinessHeaders) {
      setDashboardData(null);
      setError(null);
      setStatus('idle');
      setUpdatedAt(null);
      return;
    }

    const requestHeaders = activeBusinessHeaders;
    const controller = new AbortController();
    const ranges = getDashboardRangeQuery(rangeDays);

    async function loadDashboard() {
      setStatus('loading');
      setError(null);

      try {
        const [summary, previousSummary, salesTrend, channelBreakdown, products, inventory] =
          await Promise.all([
            fetchDashboardSummary(requestHeaders, {
              range: ranges.current,
              signal: controller.signal,
            }),
            fetchDashboardSummary(requestHeaders, {
              range: ranges.previous,
              signal: controller.signal,
            }),
            fetchDashboardSalesTrend(requestHeaders, {
              range: ranges.current,
              signal: controller.signal,
            }),
            fetchDashboardChannelBreakdown(requestHeaders, {
              range: ranges.current,
              signal: controller.signal,
            }),
            fetchProductPerformance(
              requestHeaders,
              {
                category: '',
                from: ranges.current.from,
                order: 'desc',
                page: 1,
                pageSize: 1,
                search: '',
                sort: 'revenue',
                status: '',
                to: ranges.current.to,
              },
              { signal: controller.signal },
            ),
            fetchInventoryInsights(
              requestHeaders,
              { to: ranges.current.to },
              { signal: controller.signal },
            ),
          ]);

        setDashboardData({
          channelBreakdown,
          inventory,
          previousSummary,
          products,
          salesTrend,
          summary,
        });
        setStatus('ready');
        setUpdatedAt(new Date());
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setDashboardData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard');
        setStatus('error');
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, [activeBusinessHeaders, rangeDays, reloadKey]);

  const headlineMetrics = useMemo(
    () =>
      dashboardData
        ? buildHeadlineMetrics(dashboardData.summary, dashboardData.previousSummary)
        : [],
    [dashboardData],
  );
  const decisionSignals = useMemo(
    () =>
      dashboardData
        ? buildDashboardDecisionSignals({
            channels: dashboardData.channelBreakdown,
            inventory: dashboardData.inventory,
            products: dashboardData.products,
            summary: dashboardData.summary,
          })
        : [],
    [dashboardData],
  );
  const rangeLabel = dashboardData
    ? formatDashboardRange(dashboardData.summary)
    : `Last ${rangeDays} days`;
  const isLoading = businessStatus === 'loading' || status === 'loading';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Performance overview"
        description={
          activeBusiness
            ? `${activeBusiness.name} · ${rangeLabel}`
            : 'Select a business to review performance'
        }
        actions={
          activeBusinessHeaders && (
            <DashboardControls
              isLoading={isLoading}
              rangeDays={rangeDays}
              updatedAt={updatedAt}
              onRangeChange={setRangeDays}
              onRefresh={() => setReloadKey((currentKey) => currentKey + 1)}
            />
          )
        }
      />

      {businessStatus !== 'loading' && !activeBusinessHeaders && (
        <StatePanel message="Create or select a business to view dashboard performance." />
      )}

      {activeBusinessHeaders && status === 'error' && (
        <InlineNotice
          tone="error"
          action={{
            label: 'Retry',
            onClick: () => setReloadKey((currentKey) => currentKey + 1),
          }}
        >
          {error ?? 'Unable to load dashboard performance'}
        </InlineNotice>
      )}

      {activeBusinessHeaders && status !== 'error' && (
        <>
          {isLoading ? (
            <MetricSkeletonGrid
              count={3}
              gridClassName="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1.35fr)_repeat(2,minmax(0,1fr))]"
            />
          ) : (
            <section
              className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1.35fr)_repeat(2,minmax(0,1fr))]"
              aria-label="Headline performance"
            >
              {headlineMetrics.map((metric) => (
                <HeadlineMetric key={metric.label} metric={metric} />
              ))}
            </section>
          )}

          <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
            <Surface className="min-h-[420px]">
              <SectionHeader
                eyebrow="Sales movement"
                title="Revenue and gross profit"
                description={`Compared with the previous ${rangeDays} days`}
                actions={
                  <Link to="/channels" className={getActionClassName('quiet')}>
                    Channel detail
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                }
              />
              <DashboardChartState
                businessStatus={businessStatus}
                status={status}
                error={error}
                emptyMessage="Select a business to view sales movement."
              >
                <Suspense fallback={<DashboardChartSkeleton />}>
                  {dashboardData && <SalesTrendChart data={dashboardData.salesTrend} />}
                </Suspense>
              </DashboardChartState>
            </Surface>

            <Surface tone="raised" className="min-h-[420px]">
              <SectionHeader
                eyebrow="Decision queue"
                title="Focus next"
                description="Highest-value signals from current business data"
              />
              {isLoading ? (
                <DecisionSignalSkeleton />
              ) : (
                <div className="mt-4 divide-y divide-slate-200">
                  {decisionSignals.map((signal) => (
                    <DecisionSignalRow key={signal.label} signal={signal} />
                  ))}
                </div>
              )}
            </Surface>
          </section>

          {dashboardData && <SupportingMetrics summary={dashboardData.summary} />}

          <Surface>
            <SectionHeader
              eyebrow="Revenue mix"
              title="Channel contribution"
              description="See where revenue concentration and order volume differ"
              actions={
                <Link to="/channels" className={getActionClassName('secondary')}>
                  Open channel analysis
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              }
            />
            <DashboardChartState
              businessStatus={businessStatus}
              status={status}
              error={error}
              emptyMessage="Select a business to view channel contribution."
            >
              <Suspense fallback={<DashboardChartSkeleton />}>
                {dashboardData && <ChannelPieChart data={dashboardData.channelBreakdown} />}
              </Suspense>
            </DashboardChartState>
          </Surface>
        </>
      )}
    </div>
  );
}

function DashboardControls({
  isLoading,
  onRangeChange,
  onRefresh,
  rangeDays,
  updatedAt,
}: {
  isLoading: boolean;
  onRangeChange: (days: DashboardRangeDays) => void;
  onRefresh: () => void;
  rangeDays: DashboardRangeDays;
  updatedAt: Date | null;
}) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1 sm:w-40 sm:flex-none">
          <span className="sr-only">Dashboard period</span>
          <select
            value={rangeDays}
            onChange={(event) => onRangeChange(Number(event.target.value) as DashboardRangeDays)}
            disabled={isLoading}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:bg-slate-100"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className={getActionClassName('secondary', 'shrink-0')}
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>
      <p className="text-xs text-slate-500" aria-live="polite">
        {updatedAt
          ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Compared with previous period'}
      </p>
    </div>
  );
}

function HeadlineMetric({ metric }: { metric: DashboardHeadlineMetric }) {
  const route = metric.label === 'Gross margin' ? '/products' : '/channels';
  const isHero = metric.emphasis === 'hero';

  return (
    <Link
      to={route}
      className={`group flex flex-col justify-between rounded-md border outline-none transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        isHero
          ? 'col-span-2 min-h-36 bg-slate-950 p-5 text-white shadow-sm hover:bg-slate-900 xl:col-span-1'
          : 'min-h-32 border-slate-200 bg-white p-4 text-slate-950 hover:border-slate-300 hover:shadow-sm sm:p-5'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className={`text-sm font-semibold ${isHero ? 'text-slate-300' : 'text-slate-500'}`}>
          {metric.label}
        </p>
        <ArrowRight
          aria-hidden="true"
          className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
            isHero ? 'text-slate-400' : 'text-slate-400'
          }`}
        />
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <p className={`${isHero ? 'text-4xl' : 'text-2xl sm:text-3xl'} font-bold tabular-nums`}>
          {metric.value}
        </p>
        <ChangeIndicator metric={metric} inverted={isHero} />
      </div>
    </Link>
  );
}

function ChangeIndicator({
  inverted,
  metric,
}: {
  inverted: boolean;
  metric: DashboardHeadlineMetric;
}) {
  const change = metric.changePct;
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const unit = metric.label === 'Gross margin' ? 'pts' : '%';
  const label = change === null ? 'New' : `${Math.abs(change).toFixed(1)}${unit}`;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-bold tabular-nums ${
        inverted
          ? 'bg-white/10 text-white'
          : isNegative
            ? 'bg-rose-50 text-rose-700'
            : 'bg-emerald-50 text-emerald-700'
      }`}
      aria-label={`${metric.label} change ${label}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function DecisionSignalRow({ signal }: { signal: DashboardDecisionSignal }) {
  const Icon = SIGNAL_ICONS[signal.route];
  const iconClass =
    signal.tone === 'warning'
      ? 'bg-amber-100 text-amber-700'
      : signal.tone === 'positive'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-blue-100 text-blue-700';

  return (
    <Link
      to={signal.route}
      className="group flex min-h-28 items-start gap-3 py-4 outline-none first:pt-2 last:pb-0 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-500">{signal.label}</span>
        <span className="mt-1 block text-sm font-bold text-slate-950">{signal.value}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{signal.detail}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function SupportingMetrics({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    {
      icon: CircleDollarSign,
      label: 'Gross profit',
      value: currencyFormatter.format(summary.kpis.grossProfit),
    },
    {
      icon: ReceiptText,
      label: 'Average order value',
      value: currencyFormatter.format(summary.kpis.averageOrderValue),
    },
    {
      icon: ShoppingBag,
      label: 'Units sold',
      value: numberFormatter.format(summary.kpis.unitsSold),
    },
    {
      icon: PackageSearch,
      label: 'Slow movers',
      value: numberFormatter.format(summary.kpis.slowMovers),
    },
  ];

  return (
    <section
      className="grid border-y border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Supporting performance metrics"
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className="flex min-h-24 items-center gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-950">{metric.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DashboardChartState({
  businessStatus,
  children,
  emptyMessage,
  error,
  status,
}: {
  businessStatus: ReturnType<typeof useBusinesses>['status'];
  children: ReactNode;
  emptyMessage: string;
  error: string | null;
  status: DashboardSummaryStatus;
}) {
  if (businessStatus === 'loading' || status === 'loading') {
    return <DashboardChartSkeleton />;
  }

  if (status === 'error') {
    return (
      <StatePanel
        tone="error"
        className="mt-5"
        minHeight="lg"
        message={error ?? 'Unable to load dashboard charts'}
      />
    );
  }

  if (status !== 'ready') {
    return <StatePanel className="mt-5" minHeight="lg" message={emptyMessage} />;
  }

  return children;
}

function DashboardChartSkeleton() {
  return (
    <div
      className="mt-5 h-72 animate-pulse rounded-md border border-slate-200 bg-slate-50"
      aria-label="Loading dashboard chart"
    />
  );
}

function DecisionSignalSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-label="Loading decision signals">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
