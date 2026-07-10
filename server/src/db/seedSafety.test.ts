import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSeedIsAllowed } from './seedSafety';

describe('seed safety guard', () => {
  it('allows local and test seeding by default', () => {
    assert.doesNotThrow(() => assertSeedIsAllowed({ NODE_ENV: 'development' }));
    assert.doesNotThrow(() => assertSeedIsAllowed({ NODE_ENV: 'test' }));
    assert.doesNotThrow(() => assertSeedIsAllowed({}));
  });

  it('blocks production seeding without an explicit override', () => {
    assert.throws(
      () => assertSeedIsAllowed({ NODE_ENV: 'production' }),
      /Refusing to seed a production database/,
    );
  });

  it('requires an exact override value before production seeding can run', () => {
    assert.throws(
      () =>
        assertSeedIsAllowed({
          NODE_ENV: 'production',
          ALLOW_PRODUCTION_SEED: 'yes',
        }),
      /ALLOW_PRODUCTION_SEED=true/,
    );

    assert.doesNotThrow(() =>
      assertSeedIsAllowed({
        NODE_ENV: 'production',
        ALLOW_PRODUCTION_SEED: 'true',
      }),
    );
  });
});
