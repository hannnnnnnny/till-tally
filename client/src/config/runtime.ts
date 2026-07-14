export type RouterMode = 'browser' | 'hash';

type RuntimeEnv = {
  BASE_URL?: string;
  VITE_STATIC_PREVIEW?: string;
};

export type RuntimeConfig = {
  apiAvailable: boolean;
  assetUrl: (path: string) => string;
  basePath: string;
  isStaticPreview: boolean;
  routerMode: RouterMode;
};

export function createRuntimeConfig(env: RuntimeEnv = {}): RuntimeConfig {
  const basePath = normalizeBasePath(env.BASE_URL);
  const isStaticPreview = env.VITE_STATIC_PREVIEW === 'true';

  return {
    apiAvailable: !isStaticPreview,
    assetUrl: (path) => `${basePath}${path.replace(/^\/+/, '')}`,
    basePath,
    isStaticPreview,
    routerMode: isStaticPreview ? 'hash' : 'browser',
  };
}

function normalizeBasePath(value: string | undefined): string {
  const trimmed = value?.trim() || '/';
  const withoutEdges = trimmed.replace(/^\/+|\/+$/g, '');

  return withoutEdges ? `/${withoutEdges}/` : '/';
}

export const runtimeConfig = createRuntimeConfig(import.meta.env);
