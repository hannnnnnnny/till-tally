import { type AnalyticsPlanSource, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma';
import {
  type SavedReportRecord,
  type SavedReportRepository,
  type SavedReportScope,
  type SavedReportVersionInput,
} from './savedReportService';

const reportInclude = {
  versions: { orderBy: { version: 'desc' as const } },
} satisfies Prisma.SavedReportInclude;

type ReportWithVersions = Prisma.SavedReportGetPayload<{ include: typeof reportInclude }>;
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export function createPrismaSavedReportRepository(client: PrismaClient): SavedReportRepository {
  return {
    async list(scope) {
      return (
        await client.savedReport.findMany({
          where: toWhere(scope),
          include: reportInclude,
          orderBy: { updatedAt: 'desc' },
        })
      ).map(toRecord);
    },

    async find(scope, reportId) {
      const report = await findReport(client, scope, reportId);
      return report ? toRecord(report) : null;
    },

    async create(scope, name, version) {
      return toRecord(
        await client.savedReport.create({
          data: {
            businessId: scope.businessId,
            ownerUserId: scope.userId,
            name,
            versions: {
              create: toVersionData(scope.userId, 1, version),
            },
          },
          include: reportInclude,
        }),
      );
    },

    async rename(scope, reportId, name) {
      return client.$transaction(async (transaction) => {
        const updated = await transaction.savedReport.updateMany({
          where: { id: reportId, ...toWhere(scope) },
          data: { name },
        });
        if (updated.count === 0) return null;
        const report = await findReport(transaction, scope, reportId);
        return report ? toRecord(report) : null;
      });
    },

    async addVersion(scope, reportId, version) {
      return client.$transaction(async (transaction) => {
        const updated = await transaction.savedReport.updateMany({
          where: { id: reportId, ...toWhere(scope) },
          data: { currentVersion: { increment: 1 } },
        });
        if (updated.count === 0) return null;

        const current = await transaction.savedReport.findUniqueOrThrow({
          where: { id: reportId },
          select: { currentVersion: true },
        });
        await transaction.savedReportVersion.create({
          data: {
            reportId,
            ...toVersionData(scope.userId, current.currentVersion, version),
          },
        });
        const report = await findReport(transaction, scope, reportId);
        return report ? toRecord(report) : null;
      });
    },

    async duplicate(scope, reportId, name) {
      return client.$transaction(async (transaction) => {
        const source = await findReport(transaction, scope, reportId);
        const latest = source?.versions.find(({ version }) => version === source.currentVersion);
        if (!source || !latest) return null;

        const duplicate = await transaction.savedReport.create({
          data: {
            businessId: scope.businessId,
            ownerUserId: scope.userId,
            name,
            versions: {
              create: {
                version: 1,
                schemaVersion: latest.schemaVersion,
                plan: latest.plan as Prisma.InputJsonValue,
                planSource: latest.planSource,
                createdByUserId: scope.userId,
              },
            },
          },
          include: reportInclude,
        });
        return toRecord(duplicate);
      });
    },

    async delete(scope, reportId) {
      const deleted = await client.savedReport.deleteMany({
        where: { id: reportId, ...toWhere(scope) },
      });
      return deleted.count > 0;
    },
  };
}

export const prismaSavedReportRepository = createPrismaSavedReportRepository(prisma);

function toWhere(scope: SavedReportScope) {
  return { businessId: scope.businessId, ownerUserId: scope.userId };
}

function findReport(client: TransactionClient, scope: SavedReportScope, reportId: string) {
  return client.savedReport.findFirst({
    where: { id: reportId, ...toWhere(scope) },
    include: reportInclude,
  });
}

function toVersionData(userId: string, version: number, input: SavedReportVersionInput) {
  return {
    version,
    schemaVersion: input.schemaVersion,
    plan: input.plan as Prisma.InputJsonValue,
    planSource: input.source.toUpperCase() as AnalyticsPlanSource,
    createdByUserId: userId,
  };
}

function toRecord(report: ReportWithVersions): SavedReportRecord {
  return {
    id: report.id,
    businessId: report.businessId,
    ownerUserId: report.ownerUserId,
    name: report.name,
    currentVersion: report.currentVersion,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    versions: report.versions.map((version) => ({
      version: version.version,
      schemaVersion: version.schemaVersion,
      plan: version.plan,
      source: version.planSource.toLowerCase() as 'local' | 'provider',
      createdByUserId: version.createdByUserId,
      createdAt: version.createdAt,
    })),
  };
}
