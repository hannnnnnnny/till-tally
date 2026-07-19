export const legacyBusinessMigrationName = '20260629223930_add_business_models';
export const currentBusinessMigrationName = '20260629120000_add_business_models';

type PrismaLikeError = {
  code?: unknown;
  meta?: {
    table?: unknown;
  };
};

export function isKnownBusinessMigrationDrift(appliedMigrationNames: string[]): boolean {
  const applied = new Set(appliedMigrationNames);

  return applied.has(legacyBusinessMigrationName) && !applied.has(currentBusinessMigrationName);
}

export function getKnownMigrationDriftRepairSql(): string {
  return `
UPDATE "_prisma_migrations"
SET migration_name = '${currentBusinessMigrationName}'
WHERE migration_name = '${legacyBusinessMigrationName}'
  AND finished_at IS NOT NULL
  AND rolled_back_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '${currentBusinessMigrationName}'
  );
`.trim();
}

export function getKnownMigrationDriftCleanupSql(): string {
  return `
DELETE FROM "_prisma_migrations"
WHERE migration_name = '${currentBusinessMigrationName}'
  AND finished_at IS NULL
  AND rolled_back_at IS NULL
  AND logs IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '${legacyBusinessMigrationName}'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  );
`.trim();
}

export function isPrismaMissingTableError(error: unknown, tableName?: string): boolean {
  if (!isObject(error)) {
    return false;
  }

  const prismaError = error as PrismaLikeError;

  if (prismaError.code !== 'P2021') {
    return false;
  }

  if (!tableName) {
    return true;
  }

  return typeof prismaError.meta?.table === 'string' && prismaError.meta.table.endsWith(tableName);
}

// A fresh database has no _prisma_migrations table yet: model queries fail
// with P2021, raw queries with P2010 wrapping Postgres 42P01.
export function isMissingMigrationsTableError(error: unknown): boolean {
  if (isPrismaMissingTableError(error, '_prisma_migrations')) {
    return true;
  }

  if (!isObject(error)) {
    return false;
  }

  const prismaError = error as {
    code?: unknown;
    meta?: { code?: unknown; message?: unknown };
  };

  if (prismaError.code !== 'P2010') {
    return false;
  }

  const rawMessage = typeof prismaError.meta?.message === 'string' ? prismaError.meta.message : '';

  return prismaError.meta?.code === '42P01' && rawMessage.includes('_prisma_migrations');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
