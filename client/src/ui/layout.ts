export type ActionVariant = 'primary' | 'quiet' | 'secondary';
export type PanelTone = 'metric' | 'muted' | 'plain' | 'raised';

const ACTION_BASE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const ACTION_VARIANTS: Record<ActionVariant, string> = {
  primary: 'bg-slate-950 text-white hover:bg-slate-800 active:bg-slate-900',
  quiet:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200',
  secondary:
    'border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
};

const PANEL_VARIANTS: Record<PanelTone, string> = {
  metric:
    'min-w-0 rounded-md border border-slate-200 bg-white p-4 tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  muted: 'min-w-0 rounded-md bg-slate-50 p-4',
  plain: 'min-w-0',
  raised:
    'min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6',
};

export function getActionClassName(variant: ActionVariant, className = ''): string {
  return `${ACTION_BASE} ${ACTION_VARIANTS[variant]} ${className}`.trim();
}

export function getPanelClassName(tone: PanelTone, className = ''): string {
  return `${PANEL_VARIANTS[tone]} ${className}`.trim();
}
