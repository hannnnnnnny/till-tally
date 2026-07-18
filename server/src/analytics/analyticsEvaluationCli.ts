import { runDeterministicAnalyticsEvaluation } from './analyticsEvaluation';

async function main(): Promise<void> {
  const report = await runDeterministicAnalyticsEvaluation();
  const percentage = Math.round(report.score * 100);

  console.log(
    `Analytics evaluation: ${report.passed}/${report.total} cases passed (${percentage}%)`,
  );

  for (const failure of report.failures) {
    console.error(`- ${failure.id}`);
    for (const diagnostic of failure.diagnostics) console.error(`  ${diagnostic}`);
  }

  if (report.score < 1) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Analytics evaluation failed');
  process.exitCode = 1;
});
