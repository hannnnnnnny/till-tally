import { type InventoryInsights, type InventoryInsightsQuery } from './types';

type ApiErrorBody = {
  error?: string | { message?: string };
};

type InventoryInsightsRequestOptions = {
  signal?: AbortSignal;
};

export function buildInventoryInsightsSearchParams(
  query: InventoryInsightsQuery = {},
): URLSearchParams {
  const searchParams = new URLSearchParams();

  appendOptionalStringSearchParam(searchParams, 'to', query.to);
  appendOptionalNumberSearchParam(searchParams, 'lowStockThreshold', query.lowStockThreshold);
  appendOptionalNumberSearchParam(searchParams, 'slowMoverDays', query.slowMoverDays);
  appendOptionalNumberSearchParam(searchParams, 'deadStockDays', query.deadStockDays);
  appendOptionalNumberSearchParam(searchParams, 'overstockDays', query.overstockDays);

  return searchParams;
}

export async function fetchInventoryInsights(
  businessHeaders: HeadersInit,
  query: InventoryInsightsQuery = {},
  options: InventoryInsightsRequestOptions = {},
): Promise<InventoryInsights> {
  const searchParams = buildInventoryInsightsSearchParams(query);
  const queryString = searchParams.toString();
  const url = queryString ? `/api/inventory/insights?${queryString}` : '/api/inventory/insights';
  const response = await fetch(url, {
    headers: businessHeaders,
    signal: options.signal,
  });

  return readJson<InventoryInsights>(response);
}

function appendOptionalStringSearchParam(
  searchParams: URLSearchParams,
  name: string,
  value: string | null | undefined,
): void {
  const trimmedValue = value?.trim();

  if (trimmedValue) {
    searchParams.set(name, trimmedValue);
  }
}

function appendOptionalNumberSearchParam(
  searchParams: URLSearchParams,
  name: string,
  value: number | null | undefined,
): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    searchParams.set(name, String(value));
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as T;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;

    if (typeof body.error === 'string') {
      return body.error;
    }

    return body.error?.message ?? 'Something went wrong';
  } catch {
    return 'Something went wrong';
  }
}
