export type DemoRequest = {
  body: unknown;
  method: string;
  params: Record<string, string>;
  searchParams: URLSearchParams;
};

export type DemoResponse = {
  json: unknown;
  status: number;
};

export type DemoHandler = (request: DemoRequest) => DemoResponse | Promise<DemoResponse>;

export type DemoRoute = {
  handler: DemoHandler;
  method: string;
  // Path template such as '/api/analytics/saved-reports/:reportId'.
  template: string;
};

export type DemoRouteMatch = {
  handler: DemoHandler;
  params: Record<string, string>;
};

export function matchDemoRoute(
  routes: DemoRoute[],
  method: string,
  pathname: string,
): DemoRouteMatch | null {
  for (const route of routes) {
    if (route.method !== method.toUpperCase()) {
      continue;
    }

    const params = matchTemplate(route.template, pathname);

    if (params) {
      return { handler: route.handler, params };
    }
  }

  return null;
}

export function demoErrorResponse(status: number, code: string, message: string): DemoResponse {
  return { json: { error: { code, message } }, status };
}

export const DEMO_ROUTE_MISSING = demoErrorResponse(
  404,
  'DEMO_ROUTE_MISSING',
  'This endpoint is not part of the interactive demo.',
);

function matchTemplate(template: string, pathname: string): Record<string, string> | null {
  const templateSegments = template.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  if (templateSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    const pathSegment = decodeURIComponent(pathSegments[index]);

    if (templateSegment.startsWith(':')) {
      params[templateSegment.slice(1)] = pathSegment;
    } else if (templateSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}
