import { getDemoInfo } from '../config/demoInfo';
import { runtimeConfig } from '../config/runtime';

export function DemoBanner() {
  const demoInfo = getDemoInfo();

  if (!runtimeConfig.isDemo || !demoInfo) {
    return null;
  }

  return (
    <aside
      aria-label="Demo mode notice"
      className="flex min-h-8 flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-slate-950 px-3 py-1.5 text-center text-xs font-medium text-slate-200 dark:bg-slate-900"
    >
      <span>Interactive demo — real product, sample data. Saves stay in this browser.</span>
      <a
        href={demoInfo.repoUrl}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-blue-300 underline decoration-blue-400/60 underline-offset-2 transition hover:text-blue-200"
      >
        View the source
      </a>
    </aside>
  );
}
