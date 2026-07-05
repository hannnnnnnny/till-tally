import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_NAV_ITEMS, DEFAULT_APP_PATH, getRouteTitle } from './routes';

describe('app navigation routes', () => {
  it('defines the primary shell navigation order', () => {
    assert.deepEqual(
      APP_NAV_ITEMS.map((item) => ({
        path: item.path,
        label: item.label,
      })),
      [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/channels', label: 'Channels' },
        { path: '/imports', label: 'Imports' },
        { path: '/products', label: 'Products' },
        { path: '/inventory', label: 'Inventory' },
        { path: '/reports/weekly', label: 'Reports' },
        { path: '/workspace', label: 'Workspace' },
      ],
    );
  });

  it('uses dashboard as the default authenticated route', () => {
    assert.equal(DEFAULT_APP_PATH, '/dashboard');
  });

  it('resolves page titles from route paths', () => {
    assert.equal(getRouteTitle('/dashboard'), 'Dashboard');
    assert.equal(getRouteTitle('/channels'), 'Channels');
    assert.equal(getRouteTitle('/imports'), 'Imports');
    assert.equal(getRouteTitle('/reports/weekly'), 'Reports');
    assert.equal(getRouteTitle('/unknown'), 'Dashboard');
  });
});
