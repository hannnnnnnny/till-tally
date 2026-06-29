import express, { type Request, type Response } from 'express';
import 'dotenv/config';
import { authRouter } from './auth/routes';
import { businessesRouter } from './businesses/routes';
import { importRouter } from './imports/routes';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/businesses', businessesRouter);
app.use('/api/import', importRouter);

/** Health check — confirms the API is up. */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'till-tally-api' });
});

app.listen(port, () => {
  // Startup banner (intentional log, not debug output).
  console.info(`TillTally API listening on http://localhost:${port}`);
});

export default app;
