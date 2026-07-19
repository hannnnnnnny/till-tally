import { demoErrorResponse, type DemoRoute } from './router';
import { readJsonItem, writeJsonItem, type DemoStorage } from './demoStorage';

export type DemoAuthFixture = {
  businesses: unknown;
  login: unknown;
  me: unknown;
};

export type DemoCredentials = {
  email: string;
  password: string;
};

export type DemoSessionStore = {
  clear(): void;
  isActive(): boolean;
  start(): void;
};

const SESSION_KEY = 'tilltally-demo-session';

export const DEMO_READ_ONLY_RESPONSE = demoErrorResponse(
  403,
  'DEMO_READ_ONLY',
  'This interactive demo works with a fixed sample workspace, so account and data changes are disabled.',
);

export function createDemoSessionStore(storage: DemoStorage): DemoSessionStore {
  return {
    clear: () => storage.removeItem(SESSION_KEY),
    isActive: () => readJsonItem<boolean>(storage, SESSION_KEY) === true,
    start: () => writeJsonItem(storage, SESSION_KEY, true),
  };
}

export function createAuthRoutes(
  fixture: DemoAuthFixture,
  credentials: DemoCredentials,
  session: DemoSessionStore,
): DemoRoute[] {
  const unauthenticated = demoErrorResponse(401, 'UNAUTHENTICATED', 'Missing refresh token');

  return [
    {
      handler: ({ body }) => {
        const attempt = (body ?? {}) as Partial<DemoCredentials>;
        const valid =
          attempt.email?.trim().toLowerCase() === credentials.email &&
          attempt.password === credentials.password;

        if (!valid) {
          return demoErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }

        session.start();
        return { json: fixture.login, status: 200 };
      },
      method: 'POST',
      template: '/api/auth/login',
    },
    {
      handler: () => DEMO_READ_ONLY_RESPONSE,
      method: 'POST',
      template: '/api/auth/register',
    },
    {
      handler: () => (session.isActive() ? { json: fixture.login, status: 200 } : unauthenticated),
      method: 'POST',
      template: '/api/auth/refresh',
    },
    {
      handler: () => {
        session.clear();
        return { json: null, status: 204 };
      },
      method: 'POST',
      template: '/api/auth/logout',
    },
    {
      handler: () => (session.isActive() ? { json: fixture.me, status: 200 } : unauthenticated),
      method: 'GET',
      template: '/api/auth/me',
    },
    {
      handler: () => ({ json: fixture.businesses, status: 200 }),
      method: 'GET',
      template: '/api/businesses',
    },
    {
      handler: () => DEMO_READ_ONLY_RESPONSE,
      method: 'POST',
      template: '/api/businesses',
    },
  ];
}
