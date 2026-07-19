import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getKnownMigrationDriftCleanupSql,
  getKnownMigrationDriftRepairSql,
  isKnownBusinessMigrationDrift,
  isMissingMigrationsTableError,
  isPrismaMissingTableError,
} from './migrationDrift';

describe('migration drift helpers', () => {
  it('recognizes the known business migration rename drift', () => {
    assert.equal(
      isKnownBusinessMigrationDrift([
        '20260626091520_init_users',
        '20260629223930_add_business_models',
        '20260629144900_add_import_data_models',
      ]),
      true,
    );
  });

  it('does not report drift when the current migration name is already applied', () => {
    assert.equal(
      isKnownBusinessMigrationDrift([
        '20260626091520_init_users',
        '20260629120000_add_business_models',
        '20260629144900_add_import_data_models',
      ]),
      false,
    );
  });

  it('builds a scoped repair SQL statement for the known migration rename only', () => {
    const sql = getKnownMigrationDriftRepairSql();

    assert.match(sql, /UPDATE "_prisma_migrations"/);
    assert.match(sql, /20260629223930_add_business_models/);
    assert.match(sql, /20260629120000_add_business_models/);
    assert.match(sql, /WHERE migration_name =/);
    assert.match(sql, /NOT EXISTS/);
  });

  it('builds a scoped cleanup SQL statement for a failed duplicate current migration row', () => {
    const sql = getKnownMigrationDriftCleanupSql();

    assert.match(sql, /DELETE FROM "_prisma_migrations"/);
    assert.match(sql, /20260629120000_add_business_models/);
    assert.match(sql, /20260629223930_add_business_models/);
    assert.match(sql, /finished_at IS NULL/);
    assert.match(sql, /EXISTS/);
  });

  it('recognizes Prisma missing-table errors for weekly reports', () => {
    assert.equal(
      isPrismaMissingTableError(
        {
          code: 'P2021',
          meta: {
            table: 'public.weekly_reports',
          },
        },
        'weekly_reports',
      ),
      true,
    );
  });

  it('recognizes a fresh database with no migrations table in both error shapes', () => {
    assert.equal(
      isMissingMigrationsTableError({
        code: 'P2021',
        meta: { table: 'public._prisma_migrations' },
      }),
      true,
    );
    assert.equal(
      isMissingMigrationsTableError({
        code: 'P2010',
        meta: { code: '42P01', message: 'relation "_prisma_migrations" does not exist' },
      }),
      true,
    );
  });

  it('does not treat other database failures as a fresh database', () => {
    assert.equal(
      isMissingMigrationsTableError({
        code: 'P2010',
        meta: { code: '42P01', message: 'relation "orders" does not exist' },
      }),
      false,
    );
    assert.equal(
      isMissingMigrationsTableError({
        code: 'P2010',
        meta: { code: '28P01', message: 'password authentication failed' },
      }),
      false,
    );
    assert.equal(isMissingMigrationsTableError(new Error('network down')), false);
  });
});
