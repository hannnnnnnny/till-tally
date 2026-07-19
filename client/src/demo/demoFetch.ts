import { DEMO_ROUTE_MISSING, matchDemoRoute, type DemoResponse, type DemoRoute } from './router';

type DemoFetchOptions = {
  latencyMs?: () => number;
  realFetch: typeof fetch;
};

// A short jittered delay keeps loading states visible so the demo feels like
// a real network without ever being slow.
const defaultLatencyMs = (): number => 150 + Math.random() * 150;

let installed = false;

export function createDemoFetch(routes: DemoRoute[], options: DemoFetchOptions): typeof fetch {
  const latencyMs = options.latencyMs ?? defaultLatencyMs;

  return async (input, init) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? String(input) : input.url,
      'http://demo.local',
    );

    if (!url.pathname.startsWith('/api/')) {
      return options.realFetch(input, init);
    }

    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    await sleep(latencyMs());
    const match = matchDemoRoute(routes, method, url.pathname);

    if (!match) {
      return toFetchResponse(DEMO_ROUTE_MISSING);
    }

    const result = await match.handler({
      body: parseBody(init?.body),
      method: method.toUpperCase(),
      params: match.params,
      searchParams: url.searchParams,
    });

    return toFetchResponse(result);
  };
}

export function installDemoFetch(routes: DemoRoute[]): void {
  if (installed) {
    return;
  }

  installed = true;
  window.fetch = createDemoFetch(routes, { realFetch: window.fetch.bind(window) });
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string' || body === '') {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function toFetchResponse(response: DemoResponse): Response {
  if (response.status === 204) {
    return new Response(null, { status: 204 });
  }

  return new Response(JSON.stringify(response.json), {
    headers: { 'Content-Type': 'application/json' },
    status: response.status,
  });
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
