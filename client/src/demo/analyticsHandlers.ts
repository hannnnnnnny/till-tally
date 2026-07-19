import { type DemoRoute } from './router';
import { type SavedReportStore } from './savedReports';

type AnalyticsPlanShape = {
  chart?: { type?: string };
  dimensions?: string[];
  metrics?: string[];
};

export type DemoAnalyticsPreset = {
  execution: unknown;
  plan: { plan: AnalyticsPlanShape; status: string };
  preview: unknown;
  question: string;
};

export type DemoAnalyticsFixture = {
  clarification: unknown;
  presets: DemoAnalyticsPreset[];
};

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function createAnalyticsRoutes(
  fixture: DemoAnalyticsFixture,
  savedReports: SavedReportStore,
): DemoRoute[] {
  return [
    {
      handler: ({ body }) => {
        const question = ((body ?? {}) as { question?: string }).question ?? '';
        const preset = fixture.presets.find(
          (candidate) => normalizeQuestion(candidate.question) === normalizeQuestion(question),
        );

        return { json: preset ? preset.plan : fixture.clarification, status: 200 };
      },
      method: 'POST',
      template: '/api/analytics/plan',
    },
    {
      handler: ({ body }) => ({
        json: findClosestPreset(fixture.presets, body).preview,
        status: 200,
      }),
      method: 'POST',
      template: '/api/analytics/preview',
    },
    {
      handler: ({ body }) => ({
        json: findClosestPreset(fixture.presets, body).execution,
        status: 200,
      }),
      method: 'POST',
      template: '/api/analytics/execute',
    },
    {
      handler: () => savedReports.list(),
      method: 'GET',
      template: '/api/analytics/saved-reports',
    },
    {
      handler: ({ body }) => savedReports.create(body),
      method: 'POST',
      template: '/api/analytics/saved-reports',
    },
    {
      handler: ({ params }) => savedReports.get(params.reportId),
      method: 'GET',
      template: '/api/analytics/saved-reports/:reportId',
    },
    {
      handler: ({ body, params }) => savedReports.rename(params.reportId, body),
      method: 'PATCH',
      template: '/api/analytics/saved-reports/:reportId',
    },
    {
      handler: ({ params }) => savedReports.remove(params.reportId),
      method: 'DELETE',
      template: '/api/analytics/saved-reports/:reportId',
    },
    {
      handler: ({ body, params }) => savedReports.addVersion(params.reportId, body),
      method: 'POST',
      template: '/api/analytics/saved-reports/:reportId/versions',
    },
    {
      handler: ({ body, params }) => savedReports.duplicate(params.reportId, body),
      method: 'POST',
      template: '/api/analytics/saved-reports/:reportId/duplicate',
    },
  ];
}

// Edited plans rarely match a recording exactly, so the demo returns the
// closest recorded result instead of an empty chart: shared metrics and
// dimensions dominate, the chart type breaks ties.
export function findClosestPreset(
  presets: DemoAnalyticsPreset[],
  requestedPlan: unknown,
): DemoAnalyticsPreset {
  const plan = (requestedPlan ?? {}) as AnalyticsPlanShape;
  let best = presets[0];
  let bestScore = -1;

  for (const preset of presets) {
    const candidate = preset.plan.plan;
    const score =
      overlap(plan.metrics, candidate.metrics) * 4 +
      overlap(plan.dimensions, candidate.dimensions) * 4 +
      (plan.chart?.type && plan.chart.type === candidate.chart?.type ? 1 : 0);

    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }

  return best;
}

function overlap(requested: string[] | undefined, candidate: string[] | undefined): number {
  if (!requested?.length || !candidate?.length) {
    return 0;
  }

  return requested.filter((value) => candidate.includes(value)).length;
}
