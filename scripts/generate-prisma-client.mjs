// Runs after `npm install` so a fresh clone gets a generated Prisma client.
// Docker installs dependencies before copying the schema (and the runtime image omits the
// Prisma CLI); those builds generate explicitly, so this script skips when either is missing.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repoRoot, 'server', 'prisma', 'schema.prisma');

function resolvePrismaCli() {
  try {
    return createRequire(path.join(repoRoot, 'server', 'package.json')).resolve(
      'prisma/build/index.js',
    );
  } catch {
    // Not resolvable means the CLI is not installed (e.g. a production-only install).
    return null;
  }
}

const prismaCli = resolvePrismaCli();

if (!existsSync(schemaPath) || !prismaCli) {
  console.info('Skipping Prisma client generation (schema or Prisma CLI not installed yet).');
  process.exit(0);
}

const result = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', schemaPath], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
