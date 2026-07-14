import { PrismaClient } from '@prisma/client';
import {
  currentBusinessMigrationName,
  getKnownMigrationDriftCleanupSql,
  getKnownMigrationDriftRepairSql,
  isKnownBusinessMigrationDrift,
  legacyBusinessMigrationName,
} from './migrationDrift';

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

type TableRow = {
  table_name: string;
};

const requiredBusinessTables = ['businesses', 'business_members'];
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const appliedMigrations = await prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name IN (${legacyBusinessMigrationName}, ${currentBusinessMigrationName})
  `;
  const hasFinishedLegacyMigration = appliedMigrations.some(
    (migration) =>
      migration.migration_name === legacyBusinessMigrationName &&
      migration.finished_at !== null &&
      migration.rolled_back_at === null,
  );
  const hasFailedCurrentMigration = appliedMigrations.some(
    (migration) =>
      migration.migration_name === currentBusinessMigrationName &&
      migration.finished_at === null &&
      migration.rolled_back_at === null,
  );
  let appliedMigrationNames = appliedMigrations.map((migration) => migration.migration_name);

  if (hasFinishedLegacyMigration && hasFailedCurrentMigration) {
    const deletedRows = await prisma.$executeRawUnsafe(getKnownMigrationDriftCleanupSql());

    if (deletedRows > 0) {
      console.info(
        `Removed failed duplicate Prisma migration row: ${currentBusinessMigrationName}`,
      );
      appliedMigrationNames = appliedMigrationNames.filter(
        (migrationName) => migrationName !== currentBusinessMigrationName,
      );
    }
  }

  if (!isKnownBusinessMigrationDrift(appliedMigrationNames)) {
    return;
  }

  const existingBusinessTables = await prisma.$queryRaw<TableRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('businesses', 'business_members')
  `;
  const existingTableNames = new Set(existingBusinessTables.map((table) => table.table_name));
  const missingTables = requiredBusinessTables.filter(
    (tableName) => !existingTableNames.has(tableName),
  );

  if (missingTables.length > 0) {
    throw new Error(
      `Cannot repair known Prisma migration drift because required tables are missing: ${missingTables.join(', ')}`,
    );
  }

  const updatedRows = await prisma.$executeRawUnsafe(getKnownMigrationDriftRepairSql());

  if (updatedRows > 0) {
    console.info(
      `Repaired known Prisma migration drift: ${legacyBusinessMigrationName} -> ${currentBusinessMigrationName}`,
    );
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
