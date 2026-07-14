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
      'npm run test:e2e',
      'npm run build',
    ]) {
      assert.match(workflow, new RegExp(escapeRegExp(command)));
    }
  });

  it('runs viewport regression tests with an installed Playwright browser', () => {
    const workflow = readWorkspaceFile('.github/workflows/ci.yml');

    assert.match(workflow, /npx playwright install --with-deps chromium/);
    assert.match(workflow, /npm run test:e2e/);
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

  it('typechecks the Playwright configuration and browser tests', () => {
    const rootPackageJson = JSON.parse(readWorkspaceFile('package.json')) as PackageJson;

    assert.equal(rootPackageJson.scripts['typecheck:e2e'], 'tsc --noEmit -p tsconfig.e2e.json');
    assert.match(rootPackageJson.scripts.typecheck, /npm run typecheck:e2e/);
  });

  it('deploys Pages only after CI succeeds and builds an explicit static preview', () => {
    const workflow = readWorkspaceFile('.github/workflows/deploy-pages.yml');

    assert.match(workflow, /workflow_run:/);
    assert.match(workflow, /workflows:\s*\[CI\]/);
    assert.match(workflow, /conclusion\s*==\s*'success'/);
    assert.doesNotMatch(workflow, /^\s{2}push:/m);
    assert.match(workflow, /cancel-in-progress:\s*true/);
    assert.match(workflow, /timeout-minutes:\s*15/);
    assert.match(workflow, /VITE_STATIC_PREVIEW:\s*'true'/);
    assert.match(workflow, /github\.event\.workflow_run\.head_sha/);
  });

  it('pins every GitHub Pages deployment action to an immutable commit', () => {
    const workflow = readWorkspaceFile('.github/workflows/deploy-pages.yml');
    const actionReferences = workflow.match(/^\s*uses:\s*actions\/[^@\s]+@([^\s#]+)/gm) ?? [];

    assert.equal(actionReferences.length, 5);

    for (const reference of actionReferences) {
      assert.match(reference, /@[0-9a-f]{40}$/);
    }
  });

  it('pins CI bootstrap actions and applies a finite job timeout', () => {
    const workflow = readWorkspaceFile('.github/workflows/ci.yml');
    const actionReferences = workflow.match(/^\s*uses:\s*actions\/[^@\s]+@([^\s#]+)/gm) ?? [];

    assert.equal(actionReferences.length, 2);
    assert.match(workflow, /timeout-minutes:\s*15/);

    for (const reference of actionReferences) {
      assert.match(reference, /@[0-9a-f]{40}$/);
    }
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
