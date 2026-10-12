import express, { type Express } from 'express';
import { analyticsRouter } from './analytics/routes';
import { authRouter } from './auth/routes';
import { businessesRouter } from './businesses/routes';
import { dashboardRouter } from './dashboard/routes';
import { healthRouter } from './health/routes';
import { importRouter } from './imports/routes';
import { inventoryRouter } from './inventory/routes';
import { productsRouter } from './products/routes';
import { reportsRouter } from './reports/routes';
import { errorHandler, notFoundHandler } from './http/errorMiddleware';

// Kept separate from app.ts so integration tests can mount the real API without binding a port.
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/businesses', businessesRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/import', importRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
