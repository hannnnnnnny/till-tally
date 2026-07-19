import { demoErrorResponse, type DemoResponse } from './router';
import { readJsonItem, writeJsonItem, type DemoStorage } from './demoStorage';

type SavedReportVersion = {
  createdAt: string;
  plan?: unknown;
  schemaVersion: number;
  source: string;
  version: number;
};

export type SavedReport = {
  compatibilityMessage: string | null;
  compatible: boolean;
  createdAt: string;
  currentVersion: number;
  id: string;
  latestVersion: SavedReportVersion & { plan: unknown };
  name: string;
  updatedAt?: string;
  versions: SavedReportVersion[];
};

export type SavedReportStore = {
  addVersion(reportId: string, body: unknown): DemoResponse;
  create(body: unknown): DemoResponse;
  duplicate(reportId: string, body: unknown): DemoResponse;
  get(reportId: string): DemoResponse;
  list(): DemoResponse;
  remove(reportId: string): DemoResponse;
  rename(reportId: string, body: unknown): DemoResponse;
};

const STORE_KEY = 'tilltally-demo-saved-reports';

const notFound = (): DemoResponse =>
  demoErrorResponse(404, 'REPORT_NOT_FOUND', 'Saved report not found');

export function createSavedReportStore(
  storage: DemoStorage,
  seedReports: SavedReport[],
  now: () => string = () => new Date().toISOString(),
): SavedReportStore {
  const load = (): SavedReport[] =>
    readJsonItem<SavedReport[]>(storage, STORE_KEY) ?? structuredClone(seedReports);
  const save = (reports: SavedReport[]): void => writeJsonItem(storage, STORE_KEY, reports);
  let nextId = 1;
  const createId = (): string => `demo-report-${Date.now()}-${nextId++}`;

  const buildReport = (name: string, plan: unknown, source: string): SavedReport => {
    const createdAt = now();
    const version: SavedReportVersion & { plan: unknown } = {
      createdAt,
      plan,
      schemaVersion: 1,
      source,
      version: 1,
    };

    return {
      compatibilityMessage: null,
      compatible: true,
      createdAt,
      currentVersion: 1,
      id: createId(),
      latestVersion: version,
      name,
      updatedAt: createdAt,
      versions: [{ createdAt, schemaVersion: 1, source, version: 1 }],
    };
  };

  return {
    addVersion(reportId, body) {
      const reports = load();
      const report = reports.find((candidate) => candidate.id === reportId);
      const input = (body ?? {}) as { plan?: unknown; source?: string };

      if (!report) return notFound();
      if (input.plan === undefined) {
        return demoErrorResponse(400, 'INVALID_REPORT', 'A plan is required');
      }

      const version = report.currentVersion + 1;
      const createdAt = now();
      report.currentVersion = version;
      report.latestVersion = {
        createdAt,
        plan: input.plan,
        schemaVersion: 1,
        source: input.source ?? 'local',
        version,
      };
      report.versions.push({
        createdAt,
        schemaVersion: 1,
        source: input.source ?? 'local',
        version,
      });
      report.updatedAt = createdAt;
      save(reports);
      return { json: report, status: 201 };
    },
    create(body) {
      const input = (body ?? {}) as { name?: string; plan?: unknown; source?: string };

      if (!input.name?.trim() || input.plan === undefined) {
        return demoErrorResponse(400, 'INVALID_REPORT', 'A name and plan are required');
      }

      const reports = load();
      const report = buildReport(input.name.trim(), input.plan, input.source ?? 'local');
      reports.unshift(report);
      save(reports);
      return { json: report, status: 201 };
    },
    duplicate(reportId, body) {
      const reports = load();
      const report = reports.find((candidate) => candidate.id === reportId);

      if (!report) return notFound();

      const input = (body ?? {}) as { name?: string };
      const copy = buildReport(
        input.name?.trim() || `${report.name} (copy)`,
        report.latestVersion.plan,
        report.latestVersion.source,
      );
      reports.unshift(copy);
      save(reports);
      return { json: copy, status: 201 };
    },
    get(reportId) {
      const report = load().find((candidate) => candidate.id === reportId);
      return report ? { json: report, status: 200 } : notFound();
    },
    list() {
      return { json: { reports: load() }, status: 200 };
    },
    remove(reportId) {
      const reports = load();
      const remaining = reports.filter((candidate) => candidate.id !== reportId);

      if (remaining.length === reports.length) return notFound();

      save(remaining);
      return { json: null, status: 204 };
    },
    rename(reportId, body) {
      const reports = load();
      const report = reports.find((candidate) => candidate.id === reportId);
      const input = (body ?? {}) as { name?: string };

      if (!report) return notFound();
      if (!input.name?.trim()) {
        return demoErrorResponse(400, 'INVALID_REPORT', 'A name is required');
      }

      report.name = input.name.trim();
      report.updatedAt = now();
      save(reports);
      return { json: report, status: 200 };
    },
  };
}
