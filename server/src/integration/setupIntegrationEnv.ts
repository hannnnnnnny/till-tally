import { randomBytes } from 'node:crypto';

// Must be imported before anything that constructs PrismaClient. Integration suites wipe every
// table, so they only ever run against an explicitly opted-in database URL.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

if (!integrationDatabaseUrl) {
  throw new Error(
    'INTEGRATION_DATABASE_URL is required. Point it at a disposable, migrated PostgreSQL database.',
  );
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Integration tests must never run with NODE_ENV=production');
}

process.env.DATABASE_URL = integrationDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET ??= randomBytes(32).toString('hex');
