import express, { type Request, type Response } from 'express';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

/** Health check — confirms the API is up. */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'till-tally-api' });
});

app.listen(port, () => {
  // Startup banner (intentional log, not debug output).
  console.info(`TillTally API listening on http://localhost:${port}`);
});

export default app;
