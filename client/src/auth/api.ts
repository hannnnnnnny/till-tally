import {
  type AuthFormValues,
  type AuthMode,
  type AuthResponse,
  type AuthUser,
  type RefreshResponse,
} from './types';

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

export async function submitAuthForm(
  mode: AuthMode,
  values: AuthFormValues,
): Promise<AuthResponse> {
  const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

  const body =
    mode === 'login'
      ? {
          email: values.email,
          password: values.password,
        }
      : {
          name: values.name ?? '',
          email: values.email,
          password: values.password,
        };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  return readJson<AuthResponse>(response);
}

export async function refreshAccessToken(): Promise<RefreshResponse> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  return readJson<RefreshResponse>(response);
}

export async function fetchCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await readJson<{ user: AuthUser }>(response);

  return body.user;
}

export async function logoutRequest(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
