import { AlertTriangle, Copy, FileClock, Pencil, Play, Trash2, X } from 'lucide-react';
import { type ReactNode } from 'react';
import { type SavedAnalyticsReport } from './types';
import { InlineNotice } from '../ui/StatePanel';

type SavedReportsPanelProps = {
  open: boolean;
  reports: SavedAnalyticsReport[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  activeReportId: string | null;
  disabled: boolean;
  onClose: () => void;
  onLoad: (report: SavedAnalyticsReport) => void;
  onRename: (report: SavedAnalyticsReport) => void;
  onDuplicate: (report: SavedAnalyticsReport) => void;
  onDelete: (report: SavedAnalyticsReport) => void;
  onRetry: () => void;
};

export function SavedReportsPanel({
  open,
  reports,
  status,
  error,
  activeReportId,
  disabled,
  onClose,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
  onRetry,
}: SavedReportsPanelProps) {
  if (!open) return null;

  return (
    <section
      aria-labelledby="saved-reports-title"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-4 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Report library</p>
          <h2 id="saved-reports-title" className="text-base font-bold text-slate-950">
            Saved reports
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close saved reports"
          title="Close saved reports"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {status === 'loading' && (
          <ReportLibraryState
            title="Loading saved reports"
            message="Retrieving your report plans for this business."
            loading
          />
        )}

        {status === 'error' && (
          <InlineNotice tone="error" action={{ label: 'Retry', onClick: onRetry }}>
            {error ?? 'Unable to load saved reports.'}
          </InlineNotice>
        )}

        {status === 'ready' && reports.length === 0 && (
          <ReportLibraryState
            title="No saved reports yet"
            message="Run an analysis, then save its validated plan for repeat use."
          />
        )}

        {status === 'ready' && reports.length > 0 && (
          <div className="divide-y divide-slate-200">
            {reports.map((report) => {
              const active = report.id === activeReportId;
              return (
                <article
                  key={report.id}
                  className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-slate-950">{report.name}</h3>
                      {active && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          Current
                        </span>
                      )}
                      {!report.compatible && (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Update required
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Version {report.currentVersion} | Updated {formatUpdatedAt(report.updatedAt)}
                    </p>
                    {!report.compatible && report.compatibilityMessage && (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        {report.compatibilityMessage}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1 sm:flex">
                    <ReportAction
                      label="Load"
                      icon={<Play aria-hidden="true" className="h-4 w-4" />}
                      disabled={disabled || !report.compatible}
                      onClick={() => onLoad(report)}
                    />
                    <ReportAction
                      label="Rename"
                      icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                      disabled={disabled}
                      onClick={() => onRename(report)}
                    />
                    <ReportAction
                      label="Duplicate"
                      icon={<Copy aria-hidden="true" className="h-4 w-4" />}
                      disabled={disabled || !report.compatible}
                      onClick={() => onDuplicate(report)}
                    />
                    <ReportAction
                      label="Delete"
                      icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                      disabled={disabled}
                      destructive
                      onClick={() => onDelete(report)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ReportLibraryState({
  title,
  message,
  loading = false,
}: {
  title: string;
  message: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-24 items-center gap-3 py-2" aria-live="polite">
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ${loading ? 'animate-pulse' : ''}`}
      />
      <div>
        <p className="text-sm font-bold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
      </div>
    </div>
  );
}

function ReportAction({
  label,
  icon,
  disabled,
  destructive = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 ${
        destructive
          ? 'text-red-700 hover:bg-red-50'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      }`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

export function SavedReportNameDialog({
  open,
  title,
  description,
  submitLabel,
  value,
  busy,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  value: string;
  busy: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-report-dialog-title"
        className="w-full rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-lg"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <FileClock aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 id="saved-report-dialog-title" className="text-lg font-bold text-slate-950">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>

        <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="report-name">
          Report name
        </label>
        <input
          id="report-name"
          autoFocus
          value={value}
          maxLength={80}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim()) onSubmit();
            if (event.key === 'Escape' && !busy) onCancel();
          }}
          className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-base text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            className="min-h-11 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SavedReportDeleteDialog({
  report,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  report: SavedAnalyticsReport | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!report) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-saved-report-title"
        className="w-full rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-lg"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) onCancel();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700">
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 id="delete-saved-report-title" className="text-lg font-bold text-slate-950">
              Delete saved report?
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              This permanently removes "{report.name}" and all {report.currentVersion} saved
              {report.currentVersion === 1 ? ' version' : ' versions'}.
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Keep report
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete report'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(date);
}
