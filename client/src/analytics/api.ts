import {
  type AnalyticsExecutionResult,
  type AnalyticsPlan,
  type AnalyticsPlannerRequest,
  type AnalyticsPlanningResult,
  type AnalyticsPlanPreview,
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

async function postJson<T>(
  path: string,
  businessHeaders: HeadersInit,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const headers = new Headers(businessHeaders);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  return (await response.json()) as T;
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
