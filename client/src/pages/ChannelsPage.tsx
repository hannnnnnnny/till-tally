import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import {
  buildChannelMetricCards,
  buildChannelTableRows,
  formatChannelCurrency,
  formatChannelNumber,
  formatChannelPercent,
  type ChannelMetricCard,
  type ChannelTableRow,
} from '../channels/analysis';
import { fetchDashboardChannelBreakdown } from '../dashboard/api';
import { type ChannelBreakdownResult } from '../dashboard/types';
import { PageHeader, SectionHeader, Surface } from '../ui/PageLayout';
import { getActionClassName, getPanelClassName } from '../ui/layout';
import { InlineNotice, MetricSkeletonGrid, StatePanel } from '../ui/StatePanel';

type ChannelAnalysisStatus = 'idle' | 'loading' | 'ready' | 'error';

const ChannelPieChart = lazy(() =>
  import('../dashboard/DashboardCharts').then((module) => ({
    default: module.ChannelPieChart,
  })),
);

export function ChannelsPage() {
  const { activeBusiness, activeBusinessHeaders, status: businessStatus } = useBusinesses();
  const [channelData, setChannelData] = useState<ChannelBreakdownResult | null>(null);
  const [status, setStatus] = useState<ChannelAnalysisStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeBusinessHeaders) {
      setChannelData(null);
      setError(null);
      setStatus('idle');
      return;
    }

    const requestHeaders = activeBusinessHeaders;
    const controller = new AbortController();

    async function loadChannels() {
      setStatus('loading');
      setError(null);

      try {
        const nextChannelData = await fetchDashboardChannelBreakdown(requestHeaders, {
          signal: controller.signal,
        });

        setChannelData(nextChannelData);
        setStatus('ready');
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setChannelData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load channels');
        setStatus('error');
      }
    }

    void loadChannels();

    return () => {
      controller.abort();
    };
  }, [activeBusinessHeaders, reloadKey]);

  const metricCards = useMemo(
    () => (channelData ? buildChannelMetricCards(channelData) : []),
    [channelData],
  );
  const tableRows = useMemo(
    () => (channelData ? buildChannelTableRows(channelData) : []),
    [channelData],
  );
  const isLoading = businessStatus === 'loading' || status === 'loading';
  const hasChannels = tableRows.length > 0;

  return (
    <div className="space-y-6">
      <Surface tone="plain">
        <PageHeader
          eyebrow="Channels"
          title="Channel analysis"
          description={
            activeBusiness
              ? `${activeBusiness.name} sales channel performance`
              : 'Select a business to compare sales channels'
          }
          actions={
            activeBusinessHeaders && (
              <button
                type="button"
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
                disabled={isLoading}
                className={getActionClassName('secondary', 'w-full sm:w-auto')}
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            )
          }
        />

        {businessStatus !== 'loading' && !activeBusinessHeaders && (
          <StatePanel
            className="mt-6"
            message="Create or select a business to view channel analysis."
          />
        )}

        {activeBusinessHeaders && status === 'error' && (
          <InlineNotice
            tone="error"
            className="mt-6"
            action={{
              label: 'Retry',
              onClick: () => setReloadKey((currentKey) => currentKey + 1),
            }}
          >
            {error ?? 'Unable to load channels'}
          </InlineNotice>
        )}

        {activeBusinessHeaders && (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {isLoading ? (
              <ChannelMetricSkeleton />
            ) : (
              metricCards.map((card) => <ChannelMetricCard key={card.label} card={card} />)
            )}
          </dl>
        )}
      </Surface>

      {activeBusinessHeaders && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Surface>
            <SectionHeader eyebrow="Revenue mix" title="Revenue by channel" />
            <ChannelChartState
              error={error}
              hasChannels={hasChannels}
              isLoading={isLoading}
              status={status}
            >
              <Suspense fallback={<ChannelChartSkeleton />}>
                {channelData && <ChannelPieChart data={channelData} />}
              </Suspense>
            </ChannelChartState>
          </Surface>

          <Surface>
            <SectionHeader eyebrow="Ranking" title="Channel leaderboard" />
            <ChannelLeaderboardState
              error={error}
              hasChannels={hasChannels}
              isLoading={isLoading}
              status={status}
            >
              <div className="mt-5 space-y-3">
                {tableRows.map((row) => (
                  <ChannelLeaderboardRow key={row.channel} row={row} />
                ))}
              </div>
            </ChannelLeaderboardState>
          </Surface>
        </section>
      )}

      {activeBusinessHeaders && (
        <Surface>
          <SectionHeader eyebrow="Details" title="Channel performance table" />

          <ChannelTableState
            error={error}
            hasChannels={hasChannels}
            isLoading={isLoading}
            status={status}
          >
            <ChannelTable rows={tableRows} />
          </ChannelTableState>
        </Surface>
      )}
    </div>
  );
}

function ChannelMetricCard({ card }: { card: ChannelMetricCard }) {
  return (
    <div className={getPanelClassName('metric')}>
      <dt className="text-sm font-medium text-slate-500">{card.label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{card.value}</dd>
      <dd className="mt-1 text-xs font-medium text-slate-500">{card.helper}</dd>
    </div>
  );
}

function ChannelLeaderboardRow({ row }: { row: ChannelTableRow }) {
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <h4 className="truncate text-base font-bold text-slate-950">{row.label}</h4>
          </div>
          <p className="mt-1 text-sm text-slate-500">{row.revenueShare}% revenue share</p>
        </div>
        <p className="shrink-0 text-right text-base font-bold text-slate-950">
          {formatChannelCurrency(row.revenue)}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ChannelMiniMetric label="Orders" value={formatChannelNumber(row.orders)} />
        <ChannelMiniMetric label="AOV" value={formatChannelCurrency(row.averageOrderValue)} />
        <ChannelMiniMetric label="Margin" value={formatChannelPercent(row.grossMarginPct)} />
        <ChannelMiniMetric label="Units" value={formatChannelNumber(row.unitsSold)} />
      </dl>
    </article>
  );
}

function ChannelMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function ChannelTable({ rows }: { rows: ChannelTableRow[] }) {
  return (
    <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Channel', 'Revenue', 'Orders', 'AOV', 'Gross margin', 'Units'].map((column) => (
                <th key={column} scope="col" className="px-4 py-3 font-semibold text-slate-600">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.channel}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-950">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.label}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{row.revenueShare}% revenue share</p>
                </td>
                <td className="px-4 py-4 font-semibold text-slate-950">
                  {formatChannelCurrency(row.revenue)}
                </td>
                <td className="px-4 py-4 text-slate-700">{formatChannelNumber(row.orders)}</td>
                <td className="px-4 py-4 text-slate-700">
                  {formatChannelCurrency(row.averageOrderValue)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {formatChannelPercent(row.grossMarginPct)}
                </td>
                <td className="px-4 py-4 text-slate-700">{formatChannelNumber(row.unitsSold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChannelChartState({
  children,
  error,
  hasChannels,
  isLoading,
  status,
}: {
  children: React.ReactNode;
  error: string | null;
  hasChannels: boolean;
  isLoading: boolean;
  status: ChannelAnalysisStatus;
}) {
  if (isLoading) {
    return <ChannelChartSkeleton />;
  }

  if (status === 'error') {
    return (
      <StatePanel tone="error" className="mt-5" message={error ?? 'Unable to load channel chart'} />
    );
  }

  if (!hasChannels) {
    return (
      <StatePanel className="mt-5" message="No channel revenue found for this business yet." />
    );
  }

  return children;
}

function ChannelLeaderboardState({
  children,
  error,
  hasChannels,
  isLoading,
  status,
}: {
  children: React.ReactNode;
  error: string | null;
  hasChannels: boolean;
  isLoading: boolean;
  status: ChannelAnalysisStatus;
}) {
  if (isLoading) {
    return <ChannelLeaderboardSkeleton />;
  }

  if (status === 'error') {
    return (
      <StatePanel tone="error" className="mt-5" message={error ?? 'Unable to load channels'} />
    );
  }

  if (!hasChannels) {
    return <StatePanel className="mt-5" message="No channel rows to compare yet." />;
  }

  return children;
}

function ChannelTableState({
  children,
  error,
  hasChannels,
  isLoading,
  status,
}: {
  children: React.ReactNode;
  error: string | null;
  hasChannels: boolean;
  isLoading: boolean;
  status: ChannelAnalysisStatus;
}) {
  if (isLoading) {
    return <ChannelTableSkeleton />;
  }

  if (status === 'error') {
    return (
      <StatePanel tone="error" className="mt-5" message={error ?? 'Unable to load channel table'} />
    );
  }

  if (!hasChannels) {
    return <StatePanel className="mt-5" message="No channel performance data available yet." />;
  }

  return children;
}

function ChannelMetricSkeleton() {
  return <MetricSkeletonGrid count={5} gridClassName="contents" />;
}

function ChannelChartSkeleton() {
  return <div className="mt-5 h-72 animate-pulse rounded-md bg-slate-100" />;
}

function ChannelLeaderboardSkeleton() {
  return (
    <div className="mt-5 space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

function ChannelTableSkeleton() {
  return (
    <div className="mt-5 rounded-md border border-slate-200">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="grid grid-cols-6 gap-4 border-b border-slate-100 p-4 last:border-b-0"
        >
          {Array.from({ length: 6 }, (_, cellIndex) => (
            <div key={cellIndex} className="h-4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
