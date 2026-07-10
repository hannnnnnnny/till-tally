import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('deployment healthcheck guardrails', () => {
  it('builds the server image with a readiness healthcheck command', () => {
    const dockerfile = readWorkspaceFile('server/Dockerfile');

    assert.match(dockerfile, /HEALTHCHECK/);
    assert.match(dockerfile, /server\/dist\/healthcheck\.js/);
  });

  it('waits for a healthy API before serving the production client', () => {
    const productionCompose = readWorkspaceFile('docker-compose.prod.yml');

    assert.match(productionCompose, /server:[\s\S]*healthcheck:[\s\S]*\/api\/health\/ready/);
    assert.match(productionCompose, /client:[\s\S]*depends_on:[\s\S]*server:[\s\S]*condition: service_healthy/);
  });

  it('documents readiness checks for deployment verification', () => {
    const deploymentGuide = readWorkspaceFile('docs/DEPLOYMENT.md');

    assert.match(deploymentGuide, /\/api\/health\/ready/);
    assert.match(deploymentGuide, /not_ready/);
  });
});

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
}
