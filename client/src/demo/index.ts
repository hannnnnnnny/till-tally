import { setDemoInfo } from '../config/demoInfo';
import { createAnalyticsRoutes, type DemoAnalyticsFixture } from './analyticsHandlers';
import {
  createAuthRoutes,
  createDemoSessionStore,
  type DemoAuthFixture,
} from './authHandlers';
import { installDemoFetch } from './demoFetch';
import { resolveDemoStorage } from './demoStorage';
import { createReadRoutes, type DemoReadFixtures } from './readHandlers';
import { createSavedReportStore, type SavedReport } from './savedReports';

type DemoManifest = {
  demoCredentials: { email: string; password: string };
  recordedAt: string;
};

const REPO_URL = 'https://github.com/hannnnnnnny/till-tally';

// Fixtures are recorded at deploy time and intentionally untracked. The glob
// resolves to nothing in a checkout without them, which keeps regular builds
// working; a demo build then fails here with a clear instruction instead of
// shipping an empty demo.
const fixtureModules = import.meta.glob('./fixtures/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function loadFixture<T>(name: string): T {
  const module = fixtureModules[`./fixtures/${name}.json`];

  if (module === undefined) {
    throw new Error(`Demo fixture "${name}" is missing. Run "npm run demo:record" first.`);
  }

  return module as T;
}

export function setupDemo(): void {
  const manifest = loadFixture<DemoManifest>('manifest');
  const auth = loadFixture<DemoAuthFixture>('auth');
  const analytics = loadFixture<
    DemoAnalyticsFixture & { savedReports: { reports: SavedReport[] } }
  >('analytics');
  const readFixtures: DemoReadFixtures = {
    dashboard: loadFixture('dashboard'),
    imports: loadFixture('imports'),
    inventory: loadFixture('inventory'),
    products: loadFixture('products'),
    reports: loadFixture('reports'),
  };

  const storage = resolveDemoStorage();
  const session = createDemoSessionStore(storage);
  const savedReports = createSavedReportStore(storage, analytics.savedReports.reports);

  installDemoFetch([
    ...createAuthRoutes(auth, manifest.demoCredentials, session),
    ...createReadRoutes(readFixtures, { storage }),
    ...createAnalyticsRoutes(analytics, savedReports),
  ]);

  setDemoInfo({
    credentials: manifest.demoCredentials,
    presetQuestions: analytics.presets.map((preset) => preset.question),
    repoUrl: REPO_URL,
  });
}
