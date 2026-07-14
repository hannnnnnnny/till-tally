import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('CI hygiene', () => {
  it('runs formatting, Prisma validation, lint, typecheck, test, and build checks', () => {
    const workflow = readWorkspaceFile('.github/workflows/ci.yml');

    for (const command of [
      'npm run format:check',
      'npm run prisma:validate -w server',
      'npm run lint',
      'npm run typecheck',
      'npm test --workspaces --if-present',
      'npm run build',
    ]) {
      assert.match(workflow, new RegExp(escapeRegExp(command)));
    }
  });

  it('keeps CI labels ASCII-clean so job names render correctly', () => {
    const workflow = readWorkspaceFile('.github/workflows/ci.yml');

    assert.equal(
      Array.from(workflow).every((character) => character.charCodeAt(0) <= 127),
      true,
    );
  });

  it('generates isolated JWT secrets inside the test step', () => {
    const workflow = readWorkspaceFile('.github/workflows/ci.yml');
    const testStepStart = workflow.indexOf('- name: Test');
    const buildStepStart = workflow.indexOf('- name: Build');

    assert.notEqual(testStepStart, -1);
    assert.notEqual(buildStepStart, -1);

    const testStep = workflow.slice(testStepStart, buildStepStart);

    assert.match(testStep, /NODE_ENV:\s+test/);
    assert.match(testStep, /export JWT_ACCESS_SECRET="\$\(openssl rand -hex 32\)"/);
    assert.match(testStep, /export JWT_REFRESH_SECRET="\$\(openssl rand -hex 32\)"/);
    assert.equal(testStep.match(/openssl rand -hex 32/g)?.length, 2);
  });

  it('exposes Prisma schema validation scripts at root and server workspace levels', () => {
    const rootPackageJson = JSON.parse(readWorkspaceFile('package.json')) as PackageJson;
    const serverPackageJson = JSON.parse(readWorkspaceFile('server/package.json')) as PackageJson;

    assert.equal(rootPackageJson.scripts['prisma:validate'], 'npm run prisma:validate -w server');
    assert.equal(serverPackageJson.scripts['prisma:validate'], 'prisma validate');
  });
});

type PackageJson = {
  scripts: Record<string, string>;
};

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
