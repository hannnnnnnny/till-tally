import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createSavedReportService,
  SavedReportNotFoundError,
  type SavedReportRecord,
  type SavedReportRepository,
  type SavedReportScope,
  type SavedReportVersionInput,
} from './savedReportService';

const plan = {
  schemaVersion: 1 as const,
  metrics: ['revenue' as const],
  dimensions: ['day' as const],
  dateRange: { from: '2026-07-01', to: '2026-07-19', timezone: 'Pacific/Auckland' as const },
  filters: [],
  sort: [{ field: 'day' as const, direction: 'asc' as const }],
  limit: 31,
  chart: { type: 'line' as const },
};

describe('saved report service', () => {
  it('stores only a strict validated plan and records traceable version metadata', async () => {
    const repository = new MemorySavedReportRepository();
    const service = createSavedReportService(repository);
    const created = await service.create(scope(), {
      name: '  Daily revenue  ',
      plan,
      source: 'local',
    });

    assert.equal(created.name, 'Daily revenue');
    assert.equal(created.currentVersion, 1);
    assert.equal(created.latestVersion?.schemaVersion, 1);
    assert.equal(created.latestVersion?.source, 'local');
    assert.deepEqual(created.latestVersion?.plan, plan);

    await assert.rejects(
      service.create(scope(), {
        name: 'Unsafe report',
        plan: { ...plan, rawSql: 'select * from users' },
        source: 'provider',
      }),
    );
  });

  it('supports rename, immutable plan versions, duplicate, and delete', async () => {
    const repository = new MemorySavedReportRepository();
    const service = createSavedReportService(repository);
    const created = await service.create(scope(), { name: 'Revenue', plan, source: 'local' });

    const renamed = await service.rename(scope(), created.id, { name: 'Revenue pulse' });
    assert.equal(renamed.name, 'Revenue pulse');
    assert.equal(renamed.currentVersion, 1);

    const versioned = await service.addVersion(scope(), created.id, {
      plan: { ...plan, limit: 10 },
      source: 'provider',
    });
    assert.equal(versioned.currentVersion, 2);
    assert.equal(versioned.versions.length, 2);
    assert.equal(versioned.latestVersion?.plan?.limit, 10);

    const duplicate = await service.duplicate(scope(), created.id, {});
    assert.equal(duplicate.name, 'Revenue pulse copy');
    assert.equal(duplicate.currentVersion, 1);
    assert.equal(duplicate.latestVersion?.plan?.limit, 10);

    await service.delete(scope(), created.id);
    await assert.rejects(service.get(scope(), created.id), SavedReportNotFoundError);
  });

  it('does not expose reports outside the trusted business and user scope', async () => {
    const repository = new MemorySavedReportRepository();
    const service = createSavedReportService(repository);
    const created = await service.create(scope(), { name: 'Private', plan, source: 'local' });

    await assert.rejects(
      service.get({ businessId: 'business-2', userId: 'user-1' }, created.id),
      SavedReportNotFoundError,
    );
    await assert.rejects(
      service.get({ businessId: 'business-1', userId: 'user-2' }, created.id),
      SavedReportNotFoundError,
    );
  });

  it('reports unsupported stored plan schema versions without returning an executable plan', async () => {
    const repository = new MemorySavedReportRepository();
    const service = createSavedReportService(repository);
    const created = await service.create(scope(), { name: 'Legacy', plan, source: 'local' });
    repository.reports.get(created.id)!.versions[0]!.schemaVersion = 2;

    const loaded = await service.get(scope(), created.id);

    assert.equal(loaded.compatible, false);
    assert.equal(loaded.latestVersion?.plan, null);
    assert.match(loaded.compatibilityMessage ?? '', /unsupported analytics schema version 2/i);
  });
});

function scope(): SavedReportScope {
  return { businessId: 'business-1', userId: 'user-1' };
}

class MemorySavedReportRepository implements SavedReportRepository {
  readonly reports = new Map<string, SavedReportRecord>();
  private sequence = 0;

  async list(input: SavedReportScope): Promise<SavedReportRecord[]> {
    return [...this.reports.values()].filter((report) => matches(report, input));
  }

  async find(input: SavedReportScope, reportId: string): Promise<SavedReportRecord | null> {
    const report = this.reports.get(reportId);
    return report && matches(report, input) ? report : null;
  }

  async create(input: SavedReportScope, name: string, version: SavedReportVersionInput) {
    const now = new Date('2026-07-19T01:00:00.000Z');
    const id = `report-${++this.sequence}`;
    const report: SavedReportRecord = {
      id,
      businessId: input.businessId,
      ownerUserId: input.userId,
      name,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
      versions: [toVersion(input, 1, version, now)],
    };
    this.reports.set(id, report);
    return report;
  }

  async rename(input: SavedReportScope, reportId: string, name: string) {
    const report = await this.find(input, reportId);
    if (!report) return null;
    report.name = name;
    return report;
  }

  async addVersion(input: SavedReportScope, reportId: string, version: SavedReportVersionInput) {
    const report = await this.find(input, reportId);
    if (!report) return null;
    report.currentVersion += 1;
    report.versions.unshift(toVersion(input, report.currentVersion, version, new Date()));
    return report;
  }

  async duplicate(input: SavedReportScope, reportId: string, name: string) {
    const source = await this.find(input, reportId);
    const latest = source?.versions[0];
    if (!source || !latest) return null;
    return this.create(input, name, {
      plan: planSchemaCast(latest.plan),
      source: latest.source,
      schemaVersion: latest.schemaVersion,
    });
  }

  async delete(input: SavedReportScope, reportId: string): Promise<boolean> {
    if (!(await this.find(input, reportId))) return false;
    return this.reports.delete(reportId);
  }
}

function matches(report: SavedReportRecord, input: SavedReportScope): boolean {
  return report.businessId === input.businessId && report.ownerUserId === input.userId;
}

function toVersion(
  input: SavedReportScope,
  version: number,
  value: SavedReportVersionInput,
  createdAt: Date,
) {
  return {
    version,
    schemaVersion: value.schemaVersion,
    plan: value.plan,
    source: value.source,
    createdByUserId: input.userId,
    createdAt,
  };
}

function planSchemaCast(value: unknown): typeof plan {
  return value as typeof plan;
}
