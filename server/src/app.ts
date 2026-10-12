import 'dotenv/config';
import { createApp } from './createApp';

const app = createApp();
const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // Startup banner (intentional log, not debug output).
  console.info(`TillTally API listening on http://localhost:${port}`);
});

export default app;
