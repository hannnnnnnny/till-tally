import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDashboardRangeQuery } from '../client/src/dashboard/decisionModel';

const SERVER_URL = process.env.DEMO_SERVER_URL ?? 'http://localhost:8080';
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@tilltally.local';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'DemoPass123!';
const OUTPUT_DIR = path.join(__dirname, '..', 'client', 'src', 'demo', 'fixtures');

const PRESET_QUESTIONS = [
  'Show daily revenue this month',
  'Top products by revenue this month',
  'Gross margin by channel this month',
  'Low stock by category',
  'Compare revenue and orders by channel this month',
];

const CLARIFICATION_QUESTION = 'Tell me something interesting';
const SEEDED_REPORT_NAME = 'Daily revenue pulse';
const DASHBOARD_RANGE_DAYS = [7, 30, 90] as const;

type JsonValue = unknown;

let accessToken = '';
let businessId = '';

async function request(
  method: 'GET' | 'POST',
  apiPath: string,
  body?: JsonValue,
): Promise<{ status: number; json: JsonValue }> {
  const headers: Record<string, string> = {};

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (businessId) headers['x-business-id'] = businessId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${SERVER_URL}${apiPath}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    method,
  });

  return { status: response.status, json: await response.json() };
}

async function expectOk(
  method: 'GET' | 'POST',
  apiPath: string,
  body?: JsonValue,
): Promise<JsonValue> {
  const result = await request(method, apiPath, body);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `${method} ${apiPath} failed with ${result.status}: ${JSON.stringify(result.json)}`,
    );
  }

  return result.json;
}

function writeFixture(fileName: string, data: JsonValue): void {
  writeFileSync(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`);
  console.info(`recorded ${fileName}`);
}

async function recordAuth(): Promise<void> {
  const login = (await expectOk('POST', '/api/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })) as { accessToken: string };
  accessToken = login.accessToken;

  const me = await expectOk('GET', '/api/auth/me');
  const businesses = (await expectOk('GET', '/api/businesses')) as {
    data?: Array<{ id: string }>;
  };
  const businessList = businesses.data ?? [];

  if (!businessList[0]) {
    throw new Error('The demo account has no business; run the seed first.');
  }

  businessId = businessList[0].id;
  writeFixture('auth.json', {
    businesses,
    login: { ...login, accessToken: 'demo-access-token' },
    me,
  });
}

async function recordDashboard(): Promise<void> {
  const ranges: Record<string, JsonValue> = {};

  for (const days of DASHBOARD_RANGE_DAYS) {
    const { current, previous } = getDashboardRangeQuery(days);
    const record = async (range: { from: string; to: string }) => ({
      channelBreakdown: await expectOk(
        'GET',
        `/api/dashboard/channel-breakdown?from=${range.from}&to=${range.to}`,
      ),
      range,
      salesTrend: await expectOk(
        'GET',
        `/api/dashboard/sales-trend?from=${range.from}&to=${range.to}`,
      ),
      summary: await expectOk('GET', `/api/dashboard/summary?from=${range.from}&to=${range.to}`),
    });

    ranges[String(days)] = { current: await record(current), previous: await record(previous) };
  }

  writeFixture('dashboard.json', { ranges });
}

async function recordReadModels(): Promise<void> {
  writeFixture(
    'products.json',
    await expectOk('GET', '/api/products/performance?sort=revenue&order=desc&page=1&pageSize=100'),
  );
  writeFixture('inventory.json', await expectOk('GET', '/api/inventory/insights'));
  writeFixture('imports.json', await expectOk('GET', '/api/import/jobs'));

  const missingReport = await request('GET', '/api/reports/weekly');
  const generated = await expectOk('POST', '/api/reports/weekly/generate', {});
  writeFixture('reports.json', { notFound: missingReport.json, report: generated });
}

async function recordAnalytics(): Promise<void> {
  const presets = [];

  for (const question of PRESET_QUESTIONS) {
    const plan = (await expectOk('POST', '/api/analytics/plan', { question })) as {
      status: string;
      plan?: JsonValue;
    };

    if (plan.status !== 'ready' || !plan.plan) {
      throw new Error(`Preset question did not produce a ready plan: ${question}`);
    }

    presets.push({
      execution: await expectOk('POST', '/api/analytics/execute', plan.plan),
      plan,
      preview: await expectOk('POST', '/api/analytics/preview', plan.plan),
      question,
    });
  }

  const clarification = (await expectOk('POST', '/api/analytics/plan', {
    question: CLARIFICATION_QUESTION,
  })) as { status: string };

  if (clarification.status !== 'clarification') {
    throw new Error('The clarification sample unexpectedly produced a ready plan.');
  }

  // Recording is idempotent: reuse the seeded report if a previous run of
  // this script already created it against the same database.
  const existing = (await expectOk('GET', '/api/analytics/saved-reports')) as {
    reports: Array<{ name: string }>;
  };
  const createdReport = existing.reports.find((report) => report.name === SEEDED_REPORT_NAME)
    ? existing.reports.find((report) => report.name === SEEDED_REPORT_NAME)
    : await expectOk('POST', '/api/analytics/saved-reports', {
        name: SEEDED_REPORT_NAME,
        plan: presets[0].plan.plan,
        source: 'local',
      });
  const savedReports = await expectOk('GET', '/api/analytics/saved-reports');

  writeFixture('analytics.json', { clarification, createdReport, presets, savedReports });
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await recordAuth();
  await recordDashboard();
  await recordReadModels();
  await recordAnalytics();
  writeFixture('manifest.json', {
    businessId,
    // The demo account is intentionally public; the auth page pre-fills it.
    demoCredentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    recordedAt: new Date().toISOString(),
    serverUrl: SERVER_URL,
  });
  console.info('Demo fixtures recorded.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
