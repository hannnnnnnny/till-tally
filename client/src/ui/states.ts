export type UiStateTone = 'empty' | 'error' | 'info' | 'loading' | 'success' | 'warning';

export type StateToneClasses = {
  accent: string;
  panel: string;
  text: string;
};

const STATE_TONE_CLASSES: Record<UiStateTone, StateToneClasses> = {
  empty: {
    accent: 'bg-slate-400',
    panel: 'border-dashed border-slate-300 bg-slate-50 text-slate-600',
    text: 'text-slate-600',
  },
  error: {
    accent: 'bg-red-500',
    panel: 'border-red-200 bg-red-50 text-red-700',
    text: 'text-red-700',
  },
  info: {
    accent: 'bg-blue-500',
    panel: 'border-blue-200 bg-blue-50 text-blue-800',
    text: 'text-blue-800',
  },
  loading: {
    accent: 'bg-slate-300',
    panel: 'border-slate-200 bg-slate-50 text-slate-600',
    text: 'text-slate-600',
  },
  success: {
    accent: 'bg-emerald-500',
    panel: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
  },
  warning: {
    accent: 'bg-amber-500',
    panel: 'border-amber-200 bg-amber-50 text-amber-800',
    text: 'text-amber-800',
  },
};

export function getStateToneClasses(tone: UiStateTone): StateToneClasses {
  return STATE_TONE_CLASSES[tone];
}

export function getStatePanelRole(tone: UiStateTone): 'alert' | 'status' {
  return tone === 'error' ? 'alert' : 'status';
}

export function createSkeletonItems(count: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => index);
}
