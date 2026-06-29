import { type Business, type CreateBusinessRequest } from './types';

type ApiErrorBody = {
  error?: string | { message?: string };
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

export function buildBusinessHeaders(accessToken: string, businessId: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Business-Id': businessId,
  };
}

export async function fetchBusinesses(accessToken: string): Promise<Business[]> {
  const response = await fetch('/api/businesses', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await readJson<{ data: Business[] }>(response);

  return body.data;
}

export async function createBusiness(
  accessToken: string,
  values: CreateBusinessRequest,
): Promise<Business> {
  const response = await fetch('/api/businesses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(values),
  });

  return readJson<Business>(response);
}
