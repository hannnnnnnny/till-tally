import { useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import { fetchProductPerformance } from '../products/api';
import {
  PRODUCT_STATUS_FILTERS,
  formatProductCurrency,
  formatProductLastSoldAt,
  formatProductPercent,
  formatProductStock,
  getAbcClassClass,
  getProductLabelClass,
} from '../products/table';
import {
  type ProductPerformanceItem,
  type ProductPerformanceQuery,
  type ProductPerformanceResult,
  type ProductPerformanceSort,
  type ProductSortOrder,
} from '../products/types';
import { PageHeader, Surface } from '../ui/PageLayout';
import { getActionClassName } from '../ui/layout';
import { InlineNotice, StatePanel } from '../ui/StatePanel';

const PRODUCT_COLUMNS = ['Product', 'Revenue', 'Margin', 'Units', 'ABC', 'Status'];
const PRODUCT_PAGE_SIZE = 25;

type ProductPerformanceStatus = 'idle' | 'loading' | 'ready' | 'error';

const SORT_OPTIONS: Array<{ value: ProductPerformanceSort; label: string }> = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'unitsSold', label: 'Units sold' },
  { value: 'grossMargin', label: 'Gross margin' },
];

export function ProductsPage() {
  const { activeBusiness, activeBusinessHeaders, status: businessStatus } = useBusinesses();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<ProductPerformanceSort>('revenue');
  const [order, setOrder] = useState<ProductSortOrder>('desc');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProductPerformanceResult | null>(null);
  const [loadStatus, setLoadStatus] = useState<ProductPerformanceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useMemo<ProductPerformanceQuery>(
    () => ({
      category,
      order,
      page,
      pageSize: PRODUCT_PAGE_SIZE,
      search: debouncedSearch,
      sort,
      status: statusFilter,
    }),
    [category, debouncedSearch, order, page, sort, statusFilter],
  );

  useEffect(() => {
    if (!activeBusinessHeaders) {
      setResult(null);
      setError(null);
      setLoadStatus('idle');
      return;
    }

    const requestHeaders = activeBusinessHeaders;
    const controller = new AbortController();

    async function loadProducts() {
      setLoadStatus('loading');
      setError(null);

      try {
        const nextResult = await fetchProductPerformance(requestHeaders, query, {
          signal: controller.signal,
        });

        setResult(nextResult);
        setLoadStatus('ready');
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setResult(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load products');
        setLoadStatus('error');
      }
    }

    void loadProducts();

    return () => {
      controller.abort();
    };
  }, [activeBusinessHeaders, query, reloadKey]);

  const products = result?.data ?? [];
  const meta = result?.meta ?? null;
  const hasProducts = products.length > 0;
  const isLoading = businessStatus === 'loading' || loadStatus === 'loading';

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    resetToFirstPage();
  }

  function handleCategoryChange(value: string) {
    setCategory(value);
    resetToFirstPage();
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    resetToFirstPage();
  }

  function handleSortChange(value: ProductPerformanceSort) {
    setSort(value);
    resetToFirstPage();
  }

  function handleOrderToggle() {
    setOrder((currentOrder) => (currentOrder === 'desc' ? 'asc' : 'desc'));
    resetToFirstPage();
  }

  return (
    <Surface>
      <PageHeader
        eyebrow="Products"
        title="Performance"
        description={
          activeBusiness
            ? `${activeBusiness.name} product ranking`
            : 'Select a business to view products'
        }
      />

      <div className="mt-5 grid grid-cols-2 gap-2 border-y border-slate-200 bg-slate-50/70 px-3 py-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:px-4">
        <label className="col-span-2 min-w-0 text-sm font-medium text-slate-700 lg:col-span-1">
          <span className="sr-only">Search products</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search SKU, product, vendor"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="col-span-2 min-w-0 text-sm font-medium text-slate-700 sm:col-span-1">
          <span className="sr-only">Filter by category</span>
          <input
            type="text"
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            placeholder="Category"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="min-w-0 text-sm font-medium text-slate-700">
          <span className="sr-only">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) => handleStatusFilterChange(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All status</option>
            {PRODUCT_STATUS_FILTERS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm font-medium text-slate-700">
          <span className="sr-only">Sort products</span>
          <select
            value={sort}
            onChange={(event) => handleSortChange(event.target.value as ProductPerformanceSort)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleOrderToggle}
          className={getActionClassName('secondary', 'col-span-2 sm:col-span-1 lg:col-span-1')}
        >
          {order === 'desc' ? 'Desc' : 'Asc'}
        </button>
      </div>

      {businessStatus !== 'loading' && !activeBusinessHeaders && (
        <StatePanel
          className="mt-6"
          message="Create or select a business to view product performance."
        />
      )}

      {activeBusinessHeaders && (
        <>
          {loadStatus === 'error' && (
            <InlineNotice
              tone="error"
              className="mt-6"
              action={{
                label: 'Retry',
                onClick: () => setReloadKey((currentKey) => currentKey + 1),
              }}
            >
              {error ?? 'Unable to load products'}
            </InlineNotice>
          )}

          <div className="mt-6 overflow-hidden rounded-md border border-slate-200 sm:hidden">
            {isLoading && <ProductMobileSkeleton />}

            {!isLoading && hasProducts && (
              <div className="divide-y divide-slate-100" role="list" aria-label="Products">
                {products.map((product) => (
                  <ProductMobileRow key={product.id} product={product} />
                ))}
              </div>
            )}

            {!isLoading && !hasProducts && (
              <StatePanel
                className="border-0 bg-transparent py-6"
                minHeight="sm"
                message="No products match the current filters."
              />
            )}
          </div>

          <div className="mt-6 hidden overflow-hidden rounded-md border border-slate-200 sm:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {PRODUCT_COLUMNS.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="px-4 py-3 font-semibold text-slate-600"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading && <ProductTableSkeletonRows />}

                  {!isLoading &&
                    hasProducts &&
                    products.map((product) => <ProductRow key={product.id} product={product} />)}

                  {!isLoading && !hasProducts && (
                    <tr>
                      <td colSpan={PRODUCT_COLUMNS.length} className="px-4 py-6">
                        <StatePanel
                          className="border-0 bg-transparent py-6"
                          minHeight="sm"
                          message="No products match the current filters."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {meta
                ? `${meta.total} products - Page ${meta.page} of ${Math.max(meta.totalPages, 1)}`
                : 'Loading products'}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                disabled={!meta || meta.page <= 1 || isLoading}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((currentPage) => currentPage + 1)}
                disabled={!meta || meta.page >= meta.totalPages || isLoading}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </Surface>
  );
}

function ProductRow({ product }: { product: ProductPerformanceItem }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-4">
        <div className="font-semibold text-slate-950">{product.name}</div>
        <div className="mt-1 text-xs text-slate-500">
          {product.sku}
          {product.vendor ? ` - ${product.vendor}` : ''}
        </div>
        <div className="mt-1 text-xs text-slate-500">{product.category ?? 'Uncategorised'}</div>
      </td>
      <td className="px-4 py-4">
        <div className="font-semibold text-slate-950">{formatProductCurrency(product.revenue)}</div>
        <div className="mt-1 text-xs text-slate-500">
          {formatProductPercent(product.revenueContributionPct)} contribution
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="font-semibold text-slate-950">
          {formatProductPercent(product.grossMarginPct)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatProductCurrency(product.grossProfit)} profit
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="font-semibold text-slate-950">{product.unitsSold}</div>
        <div className="mt-1 text-xs text-slate-500">
          {formatProductStock(product.currentStock)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatProductLastSoldAt(product.lastSoldAt)}
        </div>
      </td>
      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getAbcClassClass(product.abcClass)}`}
        >
          {product.abcClass}
        </span>
      </td>
      <td className="px-4 py-4">
        {product.labels.length > 0 ? (
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {product.labels.map((label) => (
              <span
                key={label}
                className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getProductLabelClass(label)}`}
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-500">No status</span>
        )}
      </td>
    </tr>
  );
}

function ProductMobileRow({ product }: { product: ProductPerformanceItem }) {
  return (
    <article className="p-4" role="listitem">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold text-slate-950">{product.name}</h3>
          <p className="mt-1 break-all text-xs text-slate-500">
            {product.sku}
            {product.vendor ? ` - ${product.vendor}` : ''}
          </p>
          <p className="mt-1 text-xs text-slate-500">{product.category ?? 'Uncategorised'}</p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${getAbcClassClass(product.abcClass)}`}
          aria-label={`ABC class ${product.abcClass}`}
        >
          {product.abcClass}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-100 py-3">
        <ProductMobileMetric label="Revenue" value={formatProductCurrency(product.revenue)} />
        <ProductMobileMetric label="Margin" value={formatProductPercent(product.grossMarginPct)} />
        <ProductMobileMetric label="Units" value={String(product.unitsSold)} />
      </dl>

      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-xs text-slate-500">
          {formatProductStock(product.currentStock)} - {formatProductLastSoldAt(product.lastSoldAt)}
        </p>
        {product.labels.length > 0 ? (
          <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
            {product.labels.map((label) => (
              <span
                key={label}
                className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${getProductLabelClass(label)}`}
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-500">No status</span>
        )}
      </div>
    </article>
  );
}

function ProductMobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-bold tabular-nums text-slate-950" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ProductMobileSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-label="Loading products">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="p-4">
          <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, metricIndex) => (
              <div key={metricIndex} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductTableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <tr key={index}>
          {PRODUCT_COLUMNS.map((column) => (
            <td key={column} className="px-4 py-4">
              <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
