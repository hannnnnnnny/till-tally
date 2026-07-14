import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRuntimeConfig } from './runtime';

describe('runtime configuration', () => {
  it('uses the full-stack browser runtime by default', () => {
    const config = createRuntimeConfig({ BASE_URL: '/' });

    assert.equal(config.isStaticPreview, false);
    assert.equal(config.apiAvailable, true);
    assert.equal(config.routerMode, 'browser');
    assert.equal(config.assetUrl('favicon.svg'), '/favicon.svg');
  });

  it('uses a hash router and disables API calls for the Pages preview', () => {
    const config = createRuntimeConfig({
      BASE_URL: '/till-tally/',
      VITE_STATIC_PREVIEW: 'true',
    });

    assert.equal(config.isStaticPreview, true);
    assert.equal(config.apiAvailable, false);
    assert.equal(config.routerMode, 'hash');
  });

  it('resolves public assets beneath the configured Vite base path', () => {
    const config = createRuntimeConfig({ BASE_URL: '/till-tally' });

    assert.equal(config.assetUrl('/favicon.svg'), '/till-tally/favicon.svg');
    assert.equal(
      config.assetUrl('screenshots/dashboard.png'),
      '/till-tally/screenshots/dashboard.png',
    );
  });
});
