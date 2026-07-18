export type RouterMode = 'browser' | 'hash';

type RuntimeEnv = {
  BASE_URL?: string;
  VITE_DEMO_MODE?: string;
  VITE_STATIC_PREVIEW?: string;
};

export type RuntimeConfig = {
  apiAvailable: boolean;
  assetUrl: (path: string) => string;
  basePath: string;
  isDemo: boolean;
  isStaticPreview: boolean;
  routerMode: RouterMode;
};

export function createRuntimeConfig(env: RuntimeEnv = {}): RuntimeConfig {
  const basePath = normalizeBasePath(env.BASE_URL);
  const isDemo = env.VITE_DEMO_MODE === 'true';
  // Demo mode supersedes the landing-only static preview: the full app runs
  // against recorded fixtures, so the API is "available" from the UI's view.
  const isStaticPreview = !isDemo && env.VITE_STATIC_PREVIEW === 'true';

  return {
    apiAvailable: !isStaticPreview,
    assetUrl: (path) => `${basePath}${path.replace(/^\/+/, '')}`,
    basePath,
    isDemo,
    isStaticPreview,
    routerMode: isDemo || isStaticPreview ? 'hash' : 'browser',
  };
}

function normalizeBasePath(value: string | undefined): string {
  const trimmed = value?.trim() || '/';
  const withoutEdges = trimmed.replace(/^\/+|\/+$/g, '');

  return withoutEdges ? `/${withoutEdges}/` : '/';
}

export const runtimeConfig = createRuntimeConfig(import.meta.env);
