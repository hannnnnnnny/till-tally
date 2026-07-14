export type HealthcheckFetch = (
  url: string,
  options: { signal: AbortSignal },
) => Promise<{ ok: boolean }>;

const DEFAULT_HEALTHCHECK_URL = 'http://127.0.0.1:4000/api/health/ready';
const DEFAULT_TIMEOUT_MS = 5000;

export async function checkHealthcheckUrl(
  url = process.env.HEALTHCHECK_URL ?? DEFAULT_HEALTHCHECK_URL,
  fetcher: HealthcheckFetch = fetch,
  timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, { signal: controller.signal });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHealthcheck(): Promise<void> {
  const isHealthy = await checkHealthcheckUrl();

  if (!isHealthy) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runHealthcheck();
}
