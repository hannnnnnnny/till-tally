import { type ElementType, type ReactNode } from 'react';
import { getPanelClassName, type PanelTone } from './layout';

type PageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
};

export function PageHeader({
  actions,
  className = '',
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header
      className={`flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-semibold text-blue-700">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h2>
        {description && (
          <div className="mt-1.5 max-w-3xl text-sm text-slate-600">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type SectionHeaderProps = {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
};

export function SectionHeader({ actions, description, eyebrow, title }: SectionHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold text-slate-500">{eyebrow}</p>}
        <h3 className="mt-1 text-lg font-bold text-slate-950">{title}</h3>
        {description && <div className="mt-1 max-w-2xl text-sm text-slate-600">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type SurfaceProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  tone?: PanelTone;
};

export function Surface({
  as: Component = 'section',
  children,
  className = '',
  tone = 'raised',
}: SurfaceProps) {
  return <Component className={getPanelClassName(tone, className)}>{children}</Component>;
}

type ControlBarProps = {
  children: ReactNode;
  className?: string;
};

export function ControlBar({ children, className = '' }: ControlBarProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 border-y border-slate-200 bg-slate-50/70 px-3 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-4 ${className}`}
    >
      {children}
    </div>
  );
}
