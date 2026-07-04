import { type ReactNode } from 'react';
import {
  createSkeletonItems,
  getStatePanelRole,
  getStateToneClasses,
  type UiStateTone,
} from './states';

type StatePanelAction = {
  label: string;
  onClick: () => void;
};

type StatePanelProps = {
  action?: StatePanelAction;
  className?: string;
  message: ReactNode;
  minHeight?: 'sm' | 'md' | 'lg';
  title?: string;
  tone?: UiStateTone;
};

const MIN_HEIGHT_CLASS: Record<NonNullable<StatePanelProps['minHeight']>, string> = {
  lg: 'min-h-72',
  md: 'min-h-48',
  sm: 'min-h-24',
};

export function StatePanel({
  action,
  className = '',
  message,
  minHeight = 'md',
  title,
  tone = 'empty',
}: StatePanelProps) {
  const classes = getStateToneClasses(tone);

  return (
    <div
      role={getStatePanelRole(tone)}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`flex ${MIN_HEIGHT_CLASS[minHeight]} items-center justify-center rounded-md border px-4 py-6 text-center text-sm ${classes.panel} ${className}`}
    >
      <div className="mx-auto max-w-md">
        <span className={`mx-auto block h-2 w-10 rounded-full ${classes.accent}`} />
        {title && <h3 className="mt-3 text-base font-bold text-slate-950">{title}</h3>}
        <div className={`mt-2 ${classes.text}`}>{message}</div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

type InlineNoticeProps = {
  action?: StatePanelAction;
  children: ReactNode;
  className?: string;
  tone?: UiStateTone;
};

export function InlineNotice({
  action,
  children,
  className = '',
  tone = 'info',
}: InlineNoticeProps) {
  const classes = getStateToneClasses(tone);

  return (
    <div
      role={getStatePanelRole(tone)}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`rounded-md border px-3 py-2 text-sm ${classes.panel} ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>{children}</div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

type SkeletonBlockProps = {
  className?: string;
};

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />;
}

type MetricSkeletonGridProps = {
  className?: string;
  count: number;
  gridClassName: string;
};

export function MetricSkeletonGrid({
  className = '',
  count,
  gridClassName,
}: MetricSkeletonGridProps) {
  return (
    <div className={gridClassName} aria-label="Loading metrics">
      {createSkeletonItems(count).map((index) => (
        <div
          key={index}
          className={`h-32 animate-pulse rounded-md border border-slate-200 bg-slate-50 p-4 ${className}`}
        >
          <SkeletonBlock className="h-4 w-24 bg-slate-200" />
          <SkeletonBlock className="mt-4 h-7 w-32 bg-slate-200" />
          <SkeletonBlock className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
