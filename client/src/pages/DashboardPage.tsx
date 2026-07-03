import { useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import { fetchDashboardSummary } from '../dashboard/api';
import { buildDashboardKpiCards, formatDashboardRange } from '../dashboard/summary';
import {
  type DashboardKpiCard,
  type DashboardKpiTone,
  type DashboardSummary,
} from '../dashboard/types';

type DashboardSummaryStatus = 'idle' | 'loading' | 'ready' | 'error';

export function DashboardPage() {
  const { activeBusiness, activeBusinessHeaders, status: businessStatus } = useBusinesses();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [status, setStatus] = useState<DashboardSummaryStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeBusinessHeaders) {
      setSummary(null);
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
        const nextSummary = await fetchDashboardSummary(requestHeaders, {
          signal: controller.signal,
        });

        setSummary(nextSummary);
        setStatus('ready');
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setSummary(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard KPIs');
        setStatus('error');
      }
    }

    void loadSummary();

    return () => {
      controller.abort();
    };
  }, [activeBusinessHeaders, reloadKey]);

  const cards = useMemo(() => (summary ? buildDashboardKpiCards(summary) : []), [summary]);
  const rangeLabel = summary ? formatDashboardRange(summary) : 'Last 30 days';

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Overview</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {activeBusiness ? activeBusiness.name : 'Dashboard'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{rangeLabel}</p>
          </div>

          {activeBusinessHeaders && (
            <button
              type="button"
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              disabled={status === 'loading'}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {status === 'loading' ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>

        {businessStatus === 'loading' && <DashboardKpiSkeleton />}

        {businessStatus !== 'loading' && !activeBusinessHeaders && <EmptyDashboardState />}

        {businessStatus !== 'loading' && status === 'loading' && <DashboardKpiSkeleton />}

        {businessStatus !== 'loading' && status === 'error' && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>{error ?? 'Unable to load dashboard KPIs'}</p>
              <button
                type="button"
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
                className="w-fit rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {businessStatus !== 'loading' && status === 'ready' && (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <KpiCard key={card.label} card={card} />
            ))}
          </dl>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Sales trend</p>
          <div className="mt-5 h-72 rounded-md border border-dashed border-slate-300 bg-slate-50" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Channel mix</p>
          <div className="mt-5 h-72 rounded-md border border-dashed border-slate-300 bg-slate-50" />
        </div>
      </section>
    </div>
  );
}

function KpiCard({ card }: { card: DashboardKpiCard }) {
  return (
    <div className={`rounded-md border p-4 ${getKpiCardClass(card.tone)}`}>
      <dt className="text-sm font-medium text-slate-500">{card.label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{card.value}</dd>
      <dd className="mt-1 text-xs font-medium text-slate-500">{card.helper}</dd>
    </div>
  );
}

function DashboardKpiSkeleton() {
  return (
    <dl
      className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-label="Loading dashboard KPIs"
    >
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          className="h-32 animate-pulse rounded-md border border-slate-200 bg-slate-50 p-4"
        >
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="mt-4 h-7 w-32 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-28 rounded bg-slate-200" />
        </div>
      ))}
    </dl>
  );
}

function EmptyDashboardState() {
  return (
    <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
      Create or select a business to view dashboard KPIs.
    </div>
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
