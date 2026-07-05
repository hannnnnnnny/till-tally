import { useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import { fetchProductPerformance } from '../products/api';
import {
  formatProductCurrency,
  formatProductPercent,
  getProductLabelClass,
} from '../products/table';
import { type ProductPerformanceItem } from '../products/types';
import { fetchWeeklyReport, generateWeeklyReport } from '../reports/api';
import {
  buildWeeklyReportMetricCards,
  buildWeeklyReportSuggestedActions,
  buildWeeklyReportWarnings,
  formatWeeklyReportGeneratedAt,
  formatWeeklyReportRange,
  getWeeklyReportToneClass,
  type WeeklyReportInsight,
  type WeeklyReportMetricCard,
} from '../reports/weeklyReport';
import { type WeeklyReport } from '../reports/types';
import { InlineNotice, StatePanel } from '../ui/StatePanel';

type WeeklyReportPageStatus = 'idle' | 'loading' | 'ready' | 'error';

export function ReportsPage() {
  const { activeBusiness, activeBusinessHeaders, status: businessStatus } = useBusinesses();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [topProducts, setTopProducts] = useState<ProductPerformanceItem[]>([]);
  const [status, setStatus] = useState<WeeklyReportPageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [weekStartInput, setWeekStartInput] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!activeBusinessHeaders) {
      setReport(null);
      setTopProducts([]);
      setError(null);
      setStatus('idle');
      return;
    }

    const requestHeaders = activeBusinessHeaders;
    const controller = new AbortController();

    async function loadWeeklyReport() {
      setStatus('loading');
      setError(null);

      try {
        const nextReport = await fetchWeeklyReport(
          requestHeaders,
          { weekStart: weekStartInput },
          { signal: controller.signal },
        );
        setReport(nextReport);

        if (!nextReport) {
          setTopProducts([]);
          setStatus('ready');
          return;
        }

        if (!weekStartInput) {
          setWeekStartInput(nextReport.weekStart);
        }

        const productResult = await fetchProductPerformance(
          requestHeaders,
          {
            category: '',
            from: nextReport.weekStart,
            order: 'desc',
            page: 1,
            pageSize: 3,
            search: '',
            sort: 'revenue',
            status: '',
            to: nextReport.weekEnd,
          },
          { signal: controller.signal },
        );
        setTopProducts(productResult.data);
        setStatus('ready');
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setReport(null);
        setTopProducts([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load weekly report');
        setStatus('error');
      }
    }

    void loadWeeklyReport();

    return () => {
      controller.abort();
    };
  }, [activeBusinessHeaders, reloadKey]);

  const metrics = useMemo(() => (report ? buildWeeklyReportMetricCards(report) : []), [report]);
  const warnings = useMemo(() => (report ? buildWeeklyReportWarnings(report) : []), [report]);
  const suggestedActions = useMemo(
    () => (report ? buildWeeklyReportSuggestedActions(report) : []),
    [report],
  );
  const isLoading = businessStatus === 'loading' || status === 'loading';

  async function handleGenerateReport() {
    if (!activeBusinessHeaders) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const nextReport = await generateWeeklyReport(activeBusinessHeaders, {
        weekStart: weekStartInput.trim() || undefined,
      });

      setWeekStartInput(nextReport.weekStart);
      setReport(nextReport);
      setStatus('ready');
      setReloadKey((currentKey) => currentKey + 1);
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : 'Unable to generate weekly report',
      );
      setStatus('error');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleLoadReport() {
    setReloadKey((currentKey) => currentKey + 1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Reports</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Weekly business report</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {activeBusiness
                ? `${activeBusiness.name} weekly summary, product focus, risks, and next actions.`
                : 'Create or select a business to generate weekly reports.'}
            </p>
          </div>

          {activeBusinessHeaders && (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_auto_auto] xl:w-auto">
              <label className="text-sm font-medium text-slate-700">
                <span className="sr-only">Week start</span>
                <input
                  type="date"
                  value={weekStartInput}
                  onChange={(event) => setWeekStartInput(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <button
                type="button"
                onClick={handleLoadReport}
                disabled={isLoading || isGenerating}
                className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isLoading ? 'Loading...' : 'Load'}
              </button>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isLoading || isGenerating}
                className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          )}
        </div>

        {businessStatus !== 'loading' && !activeBusinessHeaders && (
          <StatePanel
            className="mt-6"
            message="Create or select a business to view weekly reports."
          />
        )}

        {activeBusinessHeaders && status === 'error' && (
          <InlineNotice
            tone="error"
            className="mt-6"
            action={{
              label: 'Retry',
              onClick: handleLoadReport,
            }}
          >
            {error ?? 'Unable to load weekly report'}
          </InlineNotice>
        )}

        {activeBusinessHeaders && isLoading && <WeeklyReportSkeleton />}

        {activeBusinessHeaders && !isLoading && status === 'ready' && !report && (
          <StatePanel
            className="mt-6"
            minHeight="lg"
            title="No weekly report yet"
            message="Generate a report to summarise sales movement, category focus, inventory risks, and suggested actions."
            action={{
              label: isGenerating ? 'Generating...' : 'Generate report',
              onClick: handleGenerateReport,
            }}
          />
        )}

        {activeBusinessHeaders && !isLoading && report && (
          <WeeklyReportCard
            metrics={metrics}
            report={report}
            suggestedActions={suggestedActions}
            topProducts={topProducts}
            warnings={warnings}
          />
        )}
      </section>
    </div>
  );
}

function WeeklyReportCard({
  metrics,
  report,
  suggestedActions,
  topProducts,
  warnings,
}: {
  metrics: WeeklyReportMetricCard[];
  report: WeeklyReport;
  suggestedActions: WeeklyReportInsight[];
  topProducts: ProductPerformanceItem[];
  warnings: WeeklyReportInsight[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{formatWeeklyReportRange(report)}</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">Executive summary</h3>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {formatWeeklyReportGeneratedAt(report.createdAt)}
          </span>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-700">{report.summary}</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <WeeklyMetricCard key={metric.label} metric={metric} />
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="rounded-md border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Top products</p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Revenue leaders</h3>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {topProducts.length} shown
            </span>
          </div>

          {topProducts.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100">
              {topProducts.map((product) => (
                <TopProductRow key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <StatePanel
              className="mt-4"
              minHeight="sm"
              message="No product revenue was found for this report week."
            />
          )}
        </section>

        <div className="grid gap-6">
          <WeeklyInsightSection
            emptyMessage="No urgent warnings for this report week."
            items={warnings}
            title="Warnings"
          />
          <WeeklyInsightSection
            emptyMessage="No suggested actions yet."
            items={suggestedActions}
            title="Suggested actions"
          />
        </div>
      </div>
    </div>
  );
}

function WeeklyMetricCard({ metric }: { metric: WeeklyReportMetricCard }) {
  return (
    <div className={`rounded-md border p-4 ${getWeeklyReportToneClass(metric.tone)}`}>
      <dt className="text-xs font-semibold uppercase opacity-80">{metric.label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{metric.value}</dd>
      <p className="mt-2 text-xs font-medium opacity-80">{metric.helper}</p>
    </div>
  );
}

function TopProductRow({ product }: { product: ProductPerformanceItem }) {
  return (
    <article className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.2fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate font-semibold text-slate-950">{product.name}</h4>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            #{product.rank}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {product.sku}
          {product.category ? ` - ${product.category}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {product.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getProductLabelClass(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm sm:min-w-64">
        <TopProductMetric label="Revenue" value={formatProductCurrency(product.revenue)} />
        <TopProductMetric label="Units" value={String(product.unitsSold)} />
        <TopProductMetric label="Margin" value={formatProductPercent(product.grossMarginPct)} />
      </dl>
    </article>
  );
}

function TopProductMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function WeeklyInsightSection({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: WeeklyReportInsight[];
  title: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 p-4 sm:p-5">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>

      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article
              key={item.title}
              className={`rounded-md border px-3 py-3 ${getWeeklyReportToneClass(item.tone)}`}
            >
              <h4 className="text-sm font-bold text-slate-950">{item.title}</h4>
              <p className="mt-1 text-sm leading-5 opacity-80">{item.description}</p>
            </article>
          ))}
        </div>
      ) : (
        <StatePanel className="mt-4" minHeight="sm" tone="success" message={emptyMessage} />
      )}
    </section>
  );
}

function WeeklyReportSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-label="Loading weekly report">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-6 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-md border border-slate-200 bg-slate-50"
          />
        ))}
      </div>
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
