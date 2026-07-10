type SeedEnvironment = {
  ALLOW_PRODUCTION_SEED?: string;
  NODE_ENV?: string;
};

export function assertSeedIsAllowed(env: SeedEnvironment = process.env): void {
  if ((env.NODE_ENV ?? '').trim().toLowerCase() !== 'production') {
    return;
  }

  if ((env.ALLOW_PRODUCTION_SEED ?? '').trim() === 'true') {
    return;
  }

  throw new Error(
    'Refusing to seed a production database. Set ALLOW_PRODUCTION_SEED=true only for an intentional one-off demo data reset.',
  );
}
