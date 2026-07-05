import { type GenerateWeeklyReportInput, type WeeklyReport, type WeeklyReportQuery } from './types';

type ApiErrorBody = {
  error?: string | { message?: string };
};

type WeeklyReportRequestOptions = {
  signal?: AbortSignal;
};

export function buildWeeklyReportSearchParams(query: WeeklyReportQuery = {}): URLSearchParams {
  const searchParams = new URLSearchParams();
  const weekStart = query.weekStart?.trim();

  if (weekStart) {
    searchParams.set('weekStart', weekStart);
  }

  return searchParams;
}

export async function fetchWeeklyReport(
  businessHeaders: HeadersInit,
  query: WeeklyReportQuery = {},
  options: WeeklyReportRequestOptions = {},
): Promise<WeeklyReport | null> {
  const searchParams = buildWeeklyReportSearchParams(query);
  const queryString = searchParams.toString();
  const url = queryString ? `/api/reports/weekly?${queryString}` : '/api/reports/weekly';
  const response = await fetch(url, {
    headers: businessHeaders,
    signal: options.signal,
  });

  if (response.status === 404) {
    return null;
  }

  return readJson<WeeklyReport>(response);
}

export async function generateWeeklyReport(
  businessHeaders: HeadersInit,
  input: GenerateWeeklyReportInput = {},
): Promise<WeeklyReport> {
  const response = await fetch('/api/reports/weekly/generate', {
    body: JSON.stringify(input),
    headers: createJsonHeaders(businessHeaders),
    method: 'POST',
  });

  return readJson<WeeklyReport>(response);
}

function createJsonHeaders(businessHeaders: HeadersInit): Headers {
  const headers = new Headers(businessHeaders);
  headers.set('Content-Type', 'application/json');

  return headers;
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
