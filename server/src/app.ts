import express from 'express';
import 'dotenv/config';
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

const app = express();
const port = Number(process.env.PORT ?? 4000);

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

app.listen(port, () => {
  // Startup banner (intentional log, not debug output).
  console.info(`TillTally API listening on http://localhost:${port}`);
});

export default app;
