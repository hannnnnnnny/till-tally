import {
  type AnalyticsExecutionResult,
  type AnalyticsPlan,
  type AnalyticsPlannerRequest,
  type AnalyticsPlanningResult,
  type AnalyticsPlanPreview,
  type SavedAnalyticsReport,
} from './types';

type RequestOptions = {
  signal?: AbortSignal;
};

type ApiErrorBody = {
  error?: string | { code?: string; message?: string };
};

export class AnalyticsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AnalyticsApiError';
  }
}

export function planAnalyticsQuestion(
  businessHeaders: HeadersInit,
  input: AnalyticsPlannerRequest,
  options: RequestOptions = {},
): Promise<AnalyticsPlanningResult> {
  return postJson('/api/analytics/plan', businessHeaders, input, options);
}

export function previewAnalyticsPlan(
  businessHeaders: HeadersInit,
  plan: AnalyticsPlan,
  options: RequestOptions = {},
): Promise<AnalyticsPlanPreview> {
  return postJson('/api/analytics/preview', businessHeaders, plan, options);
}

export function executeAnalyticsPlan(
  businessHeaders: HeadersInit,
  plan: AnalyticsPlan,
  options: RequestOptions = {},
): Promise<AnalyticsExecutionResult> {
  return postJson('/api/analytics/execute', businessHeaders, plan, options);
}

export function listSavedAnalyticsReports(
  businessHeaders: HeadersInit,
  options: RequestOptions = {},
): Promise<{ reports: SavedAnalyticsReport[] }> {
  return requestJson('/api/analytics/saved-reports', businessHeaders, 'GET', undefined, options);
}

export function getSavedAnalyticsReport(
  businessHeaders: HeadersInit,
  reportId: string,
  options: RequestOptions = {},
): Promise<SavedAnalyticsReport> {
  return requestJson(savedReportPath(reportId), businessHeaders, 'GET', undefined, options);
}

export function createSavedAnalyticsReport(
  businessHeaders: HeadersInit,
  input: { name: string; plan: AnalyticsPlan; source: 'local' | 'provider' },
  options: RequestOptions = {},
): Promise<SavedAnalyticsReport> {
  return requestJson('/api/analytics/saved-reports', businessHeaders, 'POST', input, options);
}

export function renameSavedAnalyticsReport(
  businessHeaders: HeadersInit,
  reportId: string,
  name: string,
  options: RequestOptions = {},
): Promise<SavedAnalyticsReport> {
  return requestJson(savedReportPath(reportId), businessHeaders, 'PATCH', { name }, options);
}

export function addSavedAnalyticsReportVersion(
  businessHeaders: HeadersInit,
  reportId: string,
  input: { plan: AnalyticsPlan; source: 'local' | 'provider' },
  options: RequestOptions = {},
): Promise<SavedAnalyticsReport> {
  return requestJson(
    `${savedReportPath(reportId)}/versions`,
    businessHeaders,
    'POST',
    input,
    options,
  );
}

export function duplicateSavedAnalyticsReport(
  businessHeaders: HeadersInit,
  reportId: string,
  name?: string,
  options: RequestOptions = {},
): Promise<SavedAnalyticsReport> {
  return requestJson(
    `${savedReportPath(reportId)}/duplicate`,
    businessHeaders,
    'POST',
    name ? { name } : {},
    options,
  );
}

export async function deleteSavedAnalyticsReport(
  businessHeaders: HeadersInit,
  reportId: string,
  options: RequestOptions = {},
): Promise<void> {
  await requestJson(savedReportPath(reportId), businessHeaders, 'DELETE', undefined, options);
}

async function postJson<T>(
  path: string,
  businessHeaders: HeadersInit,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  return requestJson(path, businessHeaders, 'POST', body, options);
}

async function requestJson<T>(
  path: string,
  businessHeaders: HeadersInit,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const headers = new Headers(businessHeaders);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function savedReportPath(reportId: string): string {
  return `/api/analytics/saved-reports/${encodeURIComponent(reportId)}`;
}

async function readApiError(response: Response): Promise<AnalyticsApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const error = body.error;

    if (typeof error === 'string') {
      return new AnalyticsApiError(error, response.status);
    }

    return new AnalyticsApiError(
      error?.message ?? 'Unable to complete the analytics request',
      response.status,
      error?.code,
    );
  } catch {
    return new AnalyticsApiError('Unable to complete the analytics request', response.status);
  }
}
