import 'dotenv/config';

type EnvSource = Record<string, string | undefined>;

export type AppEnv = {
  nodeEnv: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  analyticsPlannerProvider: 'local' | 'ollama';
  analyticsPlannerTimeoutMs: number;
  analyticsPlannerMaxRetries: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
};

const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET_MARKERS = ['replace-with', 'change-me', 'changeme', 'placeholder'];
const JWT_DURATION_PATTERN = /^([1-9]\d*)(ms|s|m|h|d|w|y)$/;
const ANALYTICS_PLANNER_PROVIDERS = ['local', 'ollama'] as const;

function getRequiredEnv(source: EnvSource, name: string): string {
  const value = source[name];

  if (!value || value.trim() === '') {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function getOptionalEnv(source: EnvSource, name: string, fallback: string): string {
  const value = source[name];

  if (!value || value.trim() === '') {
    return fallback;
  }

  return value.trim();
}

function getJwtDuration(source: EnvSource, name: string, fallback: string): string {
  const value = getOptionalEnv(source, name, fallback);

  if (!JWT_DURATION_PATTERN.test(value)) {
    throw new Error(`${name} must be a duration like 15m or 7d`);
  }

  return value;
}

function getBoundedInteger(
  source: EnvSource,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = getOptionalEnv(source, name, String(fallback));
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function getAnalyticsPlannerProvider(source: EnvSource): AppEnv['analyticsPlannerProvider'] {
  const value = getOptionalEnv(source, 'ANALYTICS_PLANNER_PROVIDER', 'local');

  if (!ANALYTICS_PLANNER_PROVIDERS.includes(value as AppEnv['analyticsPlannerProvider'])) {
    throw new Error('ANALYTICS_PLANNER_PROVIDER must be one of: local, ollama');
  }

  return value as AppEnv['analyticsPlannerProvider'];
}

function validateHttpUrl(name: string, value: string): void {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an HTTP or HTTPS URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must be an HTTP or HTTPS URL`);
  }
}

function validateProductionJwtSecret(name: string, value: string): void {
  if (value.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
    throw new Error(`${name} must be at least 32 characters in production`);
  }

  const normalizedValue = value.toLowerCase();

  if (PLACEHOLDER_SECRET_MARKERS.some((marker) => normalizedValue.includes(marker))) {
    throw new Error(`${name} must be replaced with a production secret`);
  }
}

function validateProductionConfig(env: AppEnv): void {
  if (env.nodeEnv !== 'production') {
    return;
  }

  validateProductionJwtSecret('JWT_ACCESS_SECRET', env.jwtAccessSecret);
  validateProductionJwtSecret('JWT_REFRESH_SECRET', env.jwtRefreshSecret);

  if (env.jwtAccessSecret === env.jwtRefreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production');
  }
}

export function loadEnv(source: EnvSource = process.env): AppEnv {
  const analyticsPlannerProvider = getAnalyticsPlannerProvider(source);
  const ollamaBaseUrl = getOptionalEnv(source, 'OLLAMA_BASE_URL', 'http://127.0.0.1:11434');
  const loadedEnv = {
    nodeEnv: getOptionalEnv(source, 'NODE_ENV', 'development'),
    jwtAccessSecret: getRequiredEnv(source, 'JWT_ACCESS_SECRET'),
    jwtRefreshSecret: getRequiredEnv(source, 'JWT_REFRESH_SECRET'),
    jwtAccessExpiresIn: getJwtDuration(source, 'JWT_ACCESS_EXPIRES_IN', '15m'),
    jwtRefreshExpiresIn: getJwtDuration(source, 'JWT_REFRESH_EXPIRES_IN', '7d'),
    analyticsPlannerProvider,
    analyticsPlannerTimeoutMs: getBoundedInteger(
      source,
      'ANALYTICS_PLANNER_TIMEOUT_MS',
      8_000,
      100,
      30_000,
    ),
    analyticsPlannerMaxRetries: getBoundedInteger(source, 'ANALYTICS_PLANNER_MAX_RETRIES', 1, 0, 2),
    ollamaBaseUrl,
    ollamaModel: getOptionalEnv(source, 'OLLAMA_MODEL', 'qwen3:4b'),
  };

  if (analyticsPlannerProvider === 'ollama') {
    validateHttpUrl('OLLAMA_BASE_URL', ollamaBaseUrl);
  }

  validateProductionConfig(loadedEnv);

  return loadedEnv;
}

export const env = loadEnv();
