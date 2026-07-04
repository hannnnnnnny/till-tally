import { type ChannelBreakdownResult, type DashboardSummary, type SalesTrendResult } from './types';

type ApiErrorBody = {
  error?: string | { message?: string };
};

type DashboardRequestOptions = {
  signal?: AbortSignal;
};

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

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as T;
}

export async function fetchDashboardSummary(
  businessHeaders: HeadersInit,
  options: DashboardRequestOptions = {},
): Promise<DashboardSummary> {
  const response = await fetch('/api/dashboard/summary', {
    headers: businessHeaders,
    signal: options.signal,
  });

  return readJson<DashboardSummary>(response);
}

export async function fetchDashboardSalesTrend(
  businessHeaders: HeadersInit,
  options: DashboardRequestOptions = {},
): Promise<SalesTrendResult> {
  const response = await fetch('/api/dashboard/sales-trend', {
    headers: businessHeaders,
    signal: options.signal,
  });

  return readJson<SalesTrendResult>(response);
}

export async function fetchDashboardChannelBreakdown(
  businessHeaders: HeadersInit,
  options: DashboardRequestOptions = {},
): Promise<ChannelBreakdownResult> {
  const response = await fetch('/api/dashboard/channel-breakdown', {
    headers: businessHeaders,
    signal: options.signal,
  });

  return readJson<ChannelBreakdownResult>(response);
}
