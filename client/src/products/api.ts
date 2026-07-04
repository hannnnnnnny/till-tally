import { type ProductPerformanceQuery, type ProductPerformanceResult } from './types';

type ApiErrorBody = {
  error?: string | { message?: string };
};

type ProductPerformanceRequestOptions = {
  signal?: AbortSignal;
};

export function buildProductPerformanceSearchParams(
  query: ProductPerformanceQuery,
): URLSearchParams {
  const searchParams = new URLSearchParams({
    sort: query.sort,
    order: query.order,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  appendOptionalSearchParam(searchParams, 'search', query.search);
  appendOptionalSearchParam(searchParams, 'category', query.category);
  appendOptionalSearchParam(searchParams, 'status', query.status);

  return searchParams;
}

export async function fetchProductPerformance(
  businessHeaders: HeadersInit,
  query: ProductPerformanceQuery,
  options: ProductPerformanceRequestOptions = {},
): Promise<ProductPerformanceResult> {
  const searchParams = buildProductPerformanceSearchParams(query);
  const response = await fetch(`/api/products/performance?${searchParams.toString()}`, {
    headers: businessHeaders,
    signal: options.signal,
  });

  return readJson<ProductPerformanceResult>(response);
}

function appendOptionalSearchParam(
  searchParams: URLSearchParams,
  name: string,
  value: string,
): void {
  const trimmedValue = value.trim();

  if (trimmedValue) {
    searchParams.set(name, trimmedValue);
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
