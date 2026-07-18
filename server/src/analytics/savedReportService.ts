import {
  analyticsPlanSchema,
  parseAnalyticsPlan,
  type AnalyticsPlan,
} from '@till-tally/analytics-contracts';
import { z } from 'zod';

export const CURRENT_ANALYTICS_PLAN_SCHEMA_VERSION = 1;

export type SavedReportScope = {
  businessId: string;
  userId: string;
};

export type SavedReportVersionRecord = {
  version: number;
  schemaVersion: number;
  plan: unknown;
  source: 'local' | 'provider';
  createdByUserId: string;
  createdAt: Date;
};

export type SavedReportRecord = {
  id: string;
  businessId: string;
  ownerUserId: string;
  name: string;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
  versions: SavedReportVersionRecord[];
};

export type SavedReportVersionInput = {
  plan: AnalyticsPlan;
  source: 'local' | 'provider';
  schemaVersion: number;
};

export interface SavedReportRepository {
  list(scope: SavedReportScope): Promise<SavedReportRecord[]>;
  find(scope: SavedReportScope, reportId: string): Promise<SavedReportRecord | null>;
  create(
    scope: SavedReportScope,
    name: string,
    version: SavedReportVersionInput,
  ): Promise<SavedReportRecord>;
  rename(
    scope: SavedReportScope,
    reportId: string,
    name: string,
  ): Promise<SavedReportRecord | null>;
  addVersion(
    scope: SavedReportScope,
    reportId: string,
    version: SavedReportVersionInput,
  ): Promise<SavedReportRecord | null>;
  duplicate(
    scope: SavedReportScope,
    reportId: string,
    name: string,
  ): Promise<SavedReportRecord | null>;
  delete(scope: SavedReportScope, reportId: string): Promise<boolean>;
}

export type SavedReportResponse = {
  id: string;
  name: string;
  currentVersion: number;
  compatible: boolean;
  compatibilityMessage: string | null;
  latestVersion: {
    version: number;
    schemaVersion: number;
    source: 'local' | 'provider';
    plan: AnalyticsPlan | null;
    createdAt: string;
  } | null;
  versions: Array<{
    version: number;
    schemaVersion: number;
    source: 'local' | 'provider';
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

const reportNameSchema = z.string().trim().min(1).max(80);
const createReportSchema = z
  .object({
    name: reportNameSchema,
    plan: analyticsPlanSchema,
    source: z.enum(['local', 'provider']),
  })
  .strict();
const renameReportSchema = z.object({ name: reportNameSchema }).strict();
const addVersionSchema = z
  .object({
    plan: analyticsPlanSchema,
    source: z.enum(['local', 'provider']),
  })
  .strict();
const duplicateReportSchema = z.object({ name: reportNameSchema.optional() }).strict();

export class SavedReportNotFoundError extends Error {
  constructor() {
    super('Saved report not found');
    this.name = 'SavedReportNotFoundError';
  }
}

export function createSavedReportService(repository: SavedReportRepository) {
  return {
    async list(scope: SavedReportScope): Promise<SavedReportResponse[]> {
      return Promise.all((await repository.list(scope)).map(toResponse));
    },

    async get(scope: SavedReportScope, reportId: string): Promise<SavedReportResponse> {
      return toResponse(await requireReport(repository.find(scope, reportId)));
    },

    async create(scope: SavedReportScope, input: unknown): Promise<SavedReportResponse> {
      const parsed = createReportSchema.parse(input);
      return toResponse(
        await repository.create(scope, parsed.name, {
          plan: parsed.plan,
          source: parsed.source,
          schemaVersion: parsed.plan.schemaVersion,
        }),
      );
    },

    async rename(
      scope: SavedReportScope,
      reportId: string,
      input: unknown,
    ): Promise<SavedReportResponse> {
      const parsed = renameReportSchema.parse(input);
      return toResponse(await requireReport(repository.rename(scope, reportId, parsed.name)));
    },

    async addVersion(
      scope: SavedReportScope,
      reportId: string,
      input: unknown,
    ): Promise<SavedReportResponse> {
      const parsed = addVersionSchema.parse(input);
      return toResponse(
        await requireReport(
          repository.addVersion(scope, reportId, {
            plan: parsed.plan,
            source: parsed.source,
            schemaVersion: parsed.plan.schemaVersion,
          }),
        ),
      );
    },

    async duplicate(
      scope: SavedReportScope,
      reportId: string,
      input: unknown,
    ): Promise<SavedReportResponse> {
      const parsed = duplicateReportSchema.parse(input ?? {});
      const source = await requireReport(repository.find(scope, reportId));
      const duplicateName = parsed.name ?? createCopyName(source.name);
      return toResponse(await requireReport(repository.duplicate(scope, reportId, duplicateName)));
    },

    async delete(scope: SavedReportScope, reportId: string): Promise<void> {
      if (!(await repository.delete(scope, reportId))) throw new SavedReportNotFoundError();
    },
  };
}

export type SavedReportService = ReturnType<typeof createSavedReportService>;

async function requireReport(
  report: Promise<SavedReportRecord | null> | SavedReportRecord | null,
): Promise<SavedReportRecord> {
  const resolved = await report;
  if (!resolved) throw new SavedReportNotFoundError();
  return resolved;
}

function toResponse(record: SavedReportRecord): SavedReportResponse {
  const versions = [...record.versions].sort((left, right) => right.version - left.version);
  const latest = versions.find(({ version }) => version === record.currentVersion) ?? versions[0];
  let plan: AnalyticsPlan | null = null;
  let compatibilityMessage: string | null = null;

  if (latest) {
    if (latest.schemaVersion !== CURRENT_ANALYTICS_PLAN_SCHEMA_VERSION) {
      compatibilityMessage = `This report uses unsupported analytics schema version ${latest.schemaVersion}.`;
    } else {
      try {
        plan = parseAnalyticsPlan(latest.plan);
      } catch {
        compatibilityMessage = 'This saved report plan is no longer compatible.';
      }
    }
  } else {
    compatibilityMessage = 'This saved report has no plan version.';
  }

  return {
    id: record.id,
    name: record.name,
    currentVersion: record.currentVersion,
    compatible: plan !== null,
    compatibilityMessage,
    latestVersion: latest
      ? {
          version: latest.version,
          schemaVersion: latest.schemaVersion,
          source: latest.source,
          plan,
          createdAt: latest.createdAt.toISOString(),
        }
      : null,
    versions: versions.map((version) => ({
      version: version.version,
      schemaVersion: version.schemaVersion,
      source: version.source,
      createdAt: version.createdAt.toISOString(),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function createCopyName(name: string): string {
  const suffix = ' copy';
  return `${name.slice(0, 80 - suffix.length).trimEnd()}${suffix}`;
}
