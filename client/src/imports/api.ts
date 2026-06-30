import {
  type ImportJobDetail,
  type ImportJobsResponse,
  type ImportMode,
  type ImportResult,
} from './types';

type ApiErrorBody = {
  error?: string | { message?: string };
};

const IMPORT_ENDPOINTS: Record<ImportMode, string> = {
  ORDERS: '/api/import/orders',
  PRODUCTS: '/api/import/products',
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

async function readImportResult(response: Response): Promise<ImportResult> {
  const body = (await response.json()) as unknown;

  if (isImportResult(body)) {
    return body;
  }

  if (!response.ok) {
    throw new Error(await parseApiErrorFromBody(body));
  }

  throw new Error('Invalid import response');
}

export async function uploadImportCsv(
  mode: ImportMode,
  file: File,
  businessHeaders: HeadersInit,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(IMPORT_ENDPOINTS[mode], {
    method: 'POST',
    headers: businessHeaders,
    body: formData,
  });

  return readImportResult(response);
}

export async function fetchImportJobs(
  businessHeaders: HeadersInit,
  page = 1,
  pageSize = 10,
): Promise<ImportJobsResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/import/jobs?${searchParams.toString()}`, {
    headers: businessHeaders,
  });

  return readJson<ImportJobsResponse>(response);
}

export async function fetchImportJobDetail(
  businessHeaders: HeadersInit,
  jobId: string,
): Promise<ImportJobDetail> {
  const response = await fetch(`/api/import/jobs/${jobId}`, {
    headers: businessHeaders,
  });

  return readJson<ImportJobDetail>(response);
}

function isImportResult(value: unknown): value is ImportResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.jobId === 'string' &&
    typeof value.importType === 'string' &&
    typeof value.status === 'string' &&
    typeof value.rowsTotal === 'number' &&
    typeof value.rowsImported === 'number' &&
    typeof value.rowsFailed === 'number' &&
    Array.isArray(value.errors) &&
    Array.isArray(value.warnings)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseApiErrorFromBody(body: unknown): string {
  if (!isRecord(body)) {
    return 'Something went wrong';
  }

  const error = body.error;

  if (typeof error === 'string') {
    return error;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return 'Something went wrong';
}
