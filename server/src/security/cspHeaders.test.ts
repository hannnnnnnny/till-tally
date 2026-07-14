import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('frontend Content-Security-Policy', () => {
  const policy = extractCsp(readWorkspaceFile('client/nginx.conf'));

  it('uses a default-deny policy and explicit resource allowlists', () => {
    assert.equal(policy.get('default-src'), "'none'");
    assert.equal(policy.get('script-src'), "'self'");
    assert.equal(policy.get('connect-src'), "'self'");
    assert.equal(policy.get('img-src'), "'self' data:");
    assert.equal(policy.get('font-src'), "'self' data:");
    assert.equal(policy.get('object-src'), "'none'");
    assert.equal(policy.get('frame-src'), "'none'");
    assert.equal(policy.get('worker-src'), "'none'");
    assert.equal(policy.get('base-uri'), "'self'");
    assert.equal(policy.get('frame-ancestors'), "'none'");
    assert.equal(policy.get('form-action'), "'self'");
    assert.equal(policy.has('upgrade-insecure-requests'), true);
  });

  it('does not weaken script execution with inline or eval allowances', () => {
    assert.doesNotMatch(policy.get('script-src') ?? '', /unsafe-inline|unsafe-eval/);
    assert.equal(policy.get('script-src-attr'), "'none'");
  });

  it('scopes inline style compatibility to style attributes only', () => {
    assert.equal(policy.get('style-src'), "'self'");
    assert.equal(policy.get('style-src-elem'), "'self'");
    assert.equal(policy.get('style-src-attr'), "'unsafe-inline'");
  });
});

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
}

function extractCsp(nginxConfig: string): Map<string, string> {
  const headerMatch = nginxConfig.match(/Content-Security-Policy\s+"([^"]+)"/);

  if (!headerMatch) {
    throw new Error('Content-Security-Policy header is missing');
  }

  return new Map(
    headerMatch[1]
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...values] = directive.split(/\s+/);
        return [name, values.join(' ')] as const;
      }),
  );
}
