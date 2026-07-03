import { type DashboardSummary } from './types';

type ApiErrorBody = {
  error?: string | { message?: string };
};

type DashboardSummaryOptions = {
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
  options: DashboardSummaryOptions = {},
): Promise<DashboardSummary> {
  const response = await fetch('/api/dashboard/summary', {
    headers: businessHeaders,
    signal: options.signal,
  });

  return readJson<DashboardSummary>(response);
}
