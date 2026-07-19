import { useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import { fetchInventoryInsights } from '../inventory/api';
import {
  INVENTORY_RISK_GROUPS,
  buildInventorySummaryCards,
  formatDailySalesRate,
  formatDaysOfStockLeft,
  formatInventoryLastSoldAt,
  formatInventoryStock,
  formatInventoryWindow,
  getInventoryGroupItems,
  getInventoryLabelClass,
  type InventoryRiskGroup,
} from '../inventory/insights';
import { type InventoryInsights, type InventoryRiskItem } from '../inventory/types';
import { PageHeader, SectionHeader, Surface } from '../ui/PageLayout';
import { InlineNotice, StatePanel } from '../ui/StatePanel';

type InventoryPageStatus = 'idle' | 'loading' | 'ready' | 'error';

export function InventoryPage() {
  const { activeBusiness, activeBusinessHeaders, status: businessStatus } = useBusinesses();
  const [insights, setInsights] = useState<InventoryInsights | null>(null);
  const [loadStatus, setLoadStatus] = useState<InventoryPageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeBusinessHeaders) {
      setInsights(null);
      setError(null);
      setLoadStatus('idle');
      return;
    }

    const requestHeaders = activeBusinessHeaders;
    const controller = new AbortController();

    async function loadInventoryInsights() {
      setLoadStatus('loading');
      setError(null);

      try {
        const nextInsights = await fetchInventoryInsights(
          requestHeaders,
          {},
          {
            signal: controller.signal,
          },
        );

        setInsights(nextInsights);
        setLoadStatus('ready');
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setInsights(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load inventory insights',
        );
        setLoadStatus('error');
      }
    }

    void loadInventoryInsights();

    return () => {
      controller.abort();
    };
  }, [activeBusinessHeaders, reloadKey]);

  const isLoading = businessStatus === 'loading' || loadStatus === 'loading';
  const summaryCards = useMemo(
    () => (insights ? buildInventorySummaryCards(insights) : []),
    [insights],
  );
  const riskGroups = useMemo(
    () =>
      insights
        ? INVENTORY_RISK_GROUPS.map((group) => ({
            ...group,
            items: getInventoryGroupItems(insights, group.key),
          }))
        : [],
    [insights],
  );
  const hasAnyRiskItems = riskGroups.some((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <Surface tone="plain">
        <PageHeader
          eyebrow="Inventory"
          title="Risk overview"
          description={
            activeBusiness
              ? `${activeBusiness.name} inventory health`
              : 'Select a business to view inventory risk'
          }
          actions={
            insights && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">
                  {formatInventoryWindow(insights)}
                </span>
                <span className="block text-xs text-slate-500">
                  Generated {insights.generatedAt}
                </span>
              </div>
            )
          }
        />

        {businessStatus !== 'loading' && !activeBusinessHeaders && (
          <StatePanel
            className="mt-6"
            message="Create or select a business to view inventory insights."
          />
        )}

        {activeBusinessHeaders && loadStatus === 'error' && (
          <InlineNotice
            tone="error"
            className="mt-6"
            action={{
              label: 'Retry',
              onClick: () => setReloadKey((currentKey) => currentKey + 1),
            }}
          >
            {error ?? 'Unable to load inventory insights'}
          </InlineNotice>
        )}

        {activeBusinessHeaders && (
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-7">
            {isLoading ? (
              <InventorySummarySkeleton />
            ) : (
              summaryCards.map((card) => (
                <div key={card.key} className={`rounded-md border p-3 sm:p-4 ${card.className}`}>
                  <dt className="text-xs font-semibold uppercase">{card.label}</dt>
                  <dd className="mt-2 text-2xl font-bold sm:text-3xl">{card.value}</dd>
                  <p className="mt-2 text-xs opacity-80">{card.helper}</p>
                </div>
              ))
            )}
          </dl>
        )}
      </Surface>

      {activeBusinessHeaders && (
        <Surface>
          <SectionHeader
            eyebrow="Products"
            title="Inventory actions"
            description="Prioritise reorder, markdown, and stock-control work from the latest risk scan."
            actions={
              insights && (
                <p className="text-sm text-slate-500">
                  Sales pace uses the last {insights.salesWindow.days} days.
                </p>
              )
            }
          />

          <div className="mt-6">
            {isLoading && <InventorySectionsSkeleton />}

            {!isLoading && insights && hasAnyRiskItems && (
              <div className="space-y-6">
                {riskGroups.map((group) => (
                  <InventoryRiskSection key={group.key} group={group} items={group.items} />
                ))}
              </div>
            )}

            {!isLoading && insights && !hasAnyRiskItems && (
              <StatePanel
                minHeight="sm"
                tone="success"
                message="No inventory risk detected for the current business."
              />
            )}
          </div>
        </Surface>
      )}
    </div>
  );
}

function InventoryRiskSection({
  group,
  items,
}: {
  group: InventoryRiskGroup;
  items: InventoryRiskItem[];
}) {
  return (
    <section className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-950">{group.label}</h4>
          <p className="mt-1 text-sm text-slate-600">{group.description}</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {items.length} products
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-4 divide-y divide-slate-100">
          {items.map((item) => (
            <InventoryRiskRow key={`${group.key}-${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        <StatePanel className="mt-4" minHeight="sm" message="No products in this group." />
      )}
    </section>
  );
}

function InventoryRiskRow({ item }: { item: InventoryRiskItem }) {
  return (
    <article className="grid gap-4 py-4 lg:grid-cols-[1.2fr_1.5fr_1fr] lg:items-start">
      <div>
        <h5 className="font-semibold text-slate-950">{item.name}</h5>
        <p className="mt-1 text-xs text-slate-500">
          {item.sku}
          {item.vendor ? ` - ${item.vendor}` : ''}
        </p>
        <p className="mt-1 text-xs text-slate-500">{item.category ?? 'Uncategorised'}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <InventoryMetric label="Stock" value={formatInventoryStock(item.currentStock)} />
        <InventoryMetric label="30-day units" value={String(item.unitsSoldLast30)} />
        <InventoryMetric label="Sales pace" value={formatDailySalesRate(item.dailySalesRate)} />
        <InventoryMetric label="Runway" value={formatDaysOfStockLeft(item.daysOfStockLeft)} />
        <InventoryMetric label="Recent sale" value={formatInventoryLastSoldAt(item.lastSoldAt)} />
      </dl>

      <div className="space-y-3">
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {item.recommendation}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {item.labels.map((label) => (
            <span
              key={label}
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getInventoryLabelClass(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function InventoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function InventorySummarySkeleton() {
  return (
    <>
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-8 w-12 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </>
  );
}

function InventorySectionsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }, (_, groupIndex) => (
        <section
          key={groupIndex}
          className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-4 divide-y divide-slate-100">
            {Array.from({ length: 2 }, (_, rowIndex) => (
              <div key={rowIndex} className="grid gap-4 py-4 lg:grid-cols-3">
                <div>
                  <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }, (_, metricIndex) => (
                    <div key={metricIndex}>
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                      <div className="mt-2 h-4 w-16 animate-pulse rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
                <div className="h-9 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
