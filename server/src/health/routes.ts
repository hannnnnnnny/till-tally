import { Router } from 'express';
import { prisma } from '../db/prisma';

export type HealthCheckDatabase = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

type HealthRouterOptions = {
  database?: HealthCheckDatabase;
};

export function createHealthRouter(options: HealthRouterOptions = {}): Router {
  const database = options.database ?? prisma;
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'till-tally-api' });
  });

  router.get('/ready', async (_req, res) => {
    try {
      await database.$queryRaw`SELECT 1`;

      res.json({
        status: 'ready',
        service: 'till-tally-api',
        checks: {
          database: 'ok',
        },
      });
    } catch {
      res.status(503).json({
        status: 'not_ready',
        service: 'till-tally-api',
        checks: {
          database: 'unavailable',
        },
      });
    }
  });

  return router;
}

export const healthRouter = createHealthRouter();
