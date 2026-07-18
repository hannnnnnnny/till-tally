import { type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import {
  fetchDashboardChannelBreakdown,
  fetchDashboardSalesTrend,
  fetchDashboardSummary,
} from '../dashboard/api';
import { buildDashboardKpiCards, formatDashboardRange } from '../dashboard/summary';
import {
  type ChannelBreakdownResult,
  type DashboardKpiCard,
  type DashboardKpiTone,
  type DashboardSummary,
  type SalesTrendResult,
} from '../dashboard/types';
import { PageHeader, SectionHeader, Surface } from '../ui/PageLayout';
import { getActionClassName, getPanelClassName } from '../ui/layout';
import { InlineNotice, MetricSkeletonGrid, StatePanel } from '../ui/StatePanel';

type DashboardSummaryStatus = 'idle' | 'loading' | 'ready' | 'error';

type DashboardData = {
  channelBreakdown: ChannelBreakdownResult;
  salesTrend: SalesTrendResult;
  summary: DashboardSummary;
};

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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeBusinessHeaders) {
      setDashboardData(null);
      setError(null);
      setStatus('idle');
      return;
    }

    const requestHeaders = activeBusinessHeaders;
    const controller = new AbortController();

    async function loadSummary() {
      setStatus('loading');
      setError(null);

      try {
        const [summary, salesTrend, channelBreakdown] = await Promise.all([
          fetchDashboardSummary(requestHeaders, {
            signal: controller.signal,
          }),
          fetchDashboardSalesTrend(requestHeaders, {
            signal: controller.signal,
          }),
          fetchDashboardChannelBreakdown(requestHeaders, {
            signal: controller.signal,
          }),
        ]);

        setDashboardData({
          channelBreakdown,
          salesTrend,
          summary,
        });
        setStatus('ready');
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setDashboardData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard');
        setStatus('error');
      }
    }

    void loadSummary();

    return () => {
      controller.abort();
    };
  }, [activeBusinessHeaders, reloadKey]);

  const cards = useMemo(
    () => (dashboardData ? buildDashboardKpiCards(dashboardData.summary) : []),
    [dashboardData],
  );
  const rangeLabel = dashboardData ? formatDashboardRange(dashboardData.summary) : 'Last 30 days';

  return (
    <div className="space-y-6">
      <Surface tone="plain">
        <PageHeader
          eyebrow="Overview"
          title={activeBusiness ? activeBusiness.name : 'Business dashboard'}
          description={rangeLabel}
          actions={
            activeBusinessHeaders && (
              <button
                type="button"
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
                disabled={status === 'loading'}
                className={getActionClassName('secondary', 'w-full sm:w-auto')}
              >
                {status === 'loading' ? 'Refreshing...' : 'Refresh'}
              </button>
            )
          }
        />

        {businessStatus === 'loading' && <DashboardKpiSkeleton />}

        {businessStatus !== 'loading' && !activeBusinessHeaders && (
          <StatePanel
            className="mt-6"
            minHeight="sm"
            message="Create or select a business to view dashboard KPIs."
          />
        )}

        {businessStatus !== 'loading' && status === 'loading' && <DashboardKpiSkeleton />}

        {businessStatus !== 'loading' && status === 'error' && (
          <InlineNotice
            tone="error"
            className="mt-6"
            action={{
              label: 'Retry',
              onClick: () => setReloadKey((currentKey) => currentKey + 1),
            }}
          >
            {error ?? 'Unable to load dashboard KPIs'}
          </InlineNotice>
        )}

        {businessStatus !== 'loading' && status === 'ready' && (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <KpiCard key={card.label} card={card} />
            ))}
          </dl>
        )}
      </Surface>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Surface>
          <SectionHeader eyebrow="Sales trend" title="Sales and gross profit" />
          <DashboardChartState
            businessStatus={businessStatus}
            status={status}
            error={error}
            emptyMessage="Create or select a business to view sales trends."
          >
            <Suspense fallback={<DashboardChartSkeleton />}>
              {dashboardData && <SalesTrendChart data={dashboardData.salesTrend} />}
            </Suspense>
          </DashboardChartState>
        </Surface>

        <Surface>
          <SectionHeader eyebrow="Channel mix" title="Revenue by channel" />
          <DashboardChartState
            businessStatus={businessStatus}
            status={status}
            error={error}
            emptyMessage="Create or select a business to view channel revenue."
          >
            <Suspense fallback={<DashboardChartSkeleton />}>
              {dashboardData && <ChannelPieChart data={dashboardData.channelBreakdown} />}
            </Suspense>
          </DashboardChartState>
        </Surface>
      </section>
    </div>
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

function KpiCard({ card }: { card: DashboardKpiCard }) {
  return (
    <div className={getPanelClassName('metric', getKpiCardClass(card.tone))}>
      <dt className="text-sm font-medium text-slate-500">{card.label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{card.value}</dd>
      <dd className="mt-1 text-xs font-medium text-slate-500">{card.helper}</dd>
    </div>
  );
}

function DashboardKpiSkeleton() {
  return (
    <MetricSkeletonGrid
      count={7}
      gridClassName="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    />
  );
}

function getKpiCardClass(tone: DashboardKpiTone): string {
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50';
  }

  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50';
  }

  return 'border-slate-200 bg-slate-50';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
