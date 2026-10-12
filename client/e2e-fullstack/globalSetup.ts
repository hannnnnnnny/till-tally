import { execSync } from 'node:child_process';

// Resets the disposable E2E database to a freshly seeded demo workspace before the run.
export default function globalSetup(): void {
  const databaseUrl = process.env.E2E_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('E2E_DATABASE_URL is required for full-stack E2E tests');
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test' };

  execSync('npm run prisma:deploy -w server', { env, stdio: 'inherit' });
  execSync('npm run db:seed', { env, stdio: 'inherit' });
}
