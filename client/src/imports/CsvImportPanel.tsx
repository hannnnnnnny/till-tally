import { useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import { fetchImportJobDetail, fetchImportJobs, uploadImportCsv } from './api';
import {
  type ImportIssue,
  type ImportJobDetail,
  type ImportJobSummary,
  type ImportMode,
  type ImportResult,
  type ImportStatus,
  type ImportType,
} from './types';

const MAX_CSV_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const IMPORT_MODES: Array<{ value: ImportMode; label: string }> = [
  { value: 'ORDERS', label: 'Orders' },
  { value: 'PRODUCTS', label: 'Products' },
];

type ImportDisplayData = {
  fileName?: string;
  importType: ImportType;
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export function CsvImportPanel() {
  const { activeBusiness, activeBusinessHeaders } = useBusinesses();
  const [mode, setMode] = useState<ImportMode>('ORDERS');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<ImportResult | null>(null);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedJobDetail, setSelectedJobDetail] = useState<ImportJobDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const displayData = useMemo<ImportDisplayData | null>(() => {
    if (selectedJobDetail) {
      return {
        fileName: selectedJobDetail.fileName,
        importType: selectedJobDetail.importType,
        status: selectedJobDetail.status,
        rowsTotal: selectedJobDetail.rowsTotal,
        rowsImported: selectedJobDetail.rowsImported,
        rowsFailed: selectedJobDetail.rowsFailed,
        errors: selectedJobDetail.errorSummary.errors,
        warnings: selectedJobDetail.errorSummary.warnings,
      };
    }

    if (latestResult) {
      return {
        importType: latestResult.importType,
        status: latestResult.status,
        rowsTotal: latestResult.rowsTotal,
        rowsImported: latestResult.rowsImported,
        rowsFailed: latestResult.rowsFailed,
        errors: latestResult.errors,
        warnings: latestResult.warnings,
      };
    }

    return null;
  }, [latestResult, selectedJobDetail]);

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      if (!activeBusinessHeaders) {
        setJobs([]);
        setHistoryError(null);
        return;
      }

      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const response = await fetchImportJobs(activeBusinessHeaders);

        if (!isActive) {
          return;
        }

        setJobs(response.data);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setHistoryError(error instanceof Error ? error.message : 'Unable to load import history');
      } finally {
        if (isActive) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [activeBusinessHeaders]);

  function handleFileSelection(file: File | null) {
    setUploadError(null);
    setLatestResult(null);
    setSelectedJobDetail(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isCsvFile(file)) {
      setSelectedFile(null);
      setUploadError('Choose a .csv file');
      return;
    }

    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setUploadError('CSV file must be 25 MB or smaller');
      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!activeBusinessHeaders) {
      setUploadError('Select a business before importing data');
      return;
    }

    if (!selectedFile) {
      setUploadError('Choose a CSV file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setSelectedJobDetail(null);

    try {
      const result = await uploadImportCsv(mode, selectedFile, activeBusinessHeaders);
      const history = await fetchImportJobs(activeBusinessHeaders);

      setLatestResult(result);
      setJobs(history.data);
      setSelectedFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleJobSelect(jobId: string) {
    if (!activeBusinessHeaders) {
      return;
    }

    setIsLoadingDetail(true);
    setUploadError(null);

    try {
      const detail = await fetchImportJobDetail(activeBusinessHeaders, jobId);
      setSelectedJobDetail(detail);
      setLatestResult(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to load import report');
    } finally {
      setIsLoadingDetail(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Data import</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">CSV imports</h2>
          {activeBusiness && (
            <p className="mt-1 text-sm text-slate-600">{activeBusiness.name}</p>
          )}
        </div>

        <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 sm:w-56">
          {IMPORT_MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={`rounded px-3 py-2 text-sm font-medium ${
                mode === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className="space-y-6">
          <CsvUploadBox
            disabled={!activeBusinessHeaders || isUploading}
            isDragging={isDragging}
            isUploading={isUploading}
            selectedFile={selectedFile}
            uploadError={uploadError}
            onDragChange={setIsDragging}
            onFileSelect={handleFileSelection}
            onUpload={handleUpload}
          />

          <ImportHistory
            jobs={jobs}
            isLoading={isLoadingHistory}
            error={historyError}
            selectedJobId={selectedJobDetail?.id ?? null}
            onJobSelect={handleJobSelect}
          />
        </div>

        <ImportResultPanel data={displayData} isLoadingDetail={isLoadingDetail} />
      </div>
    </section>
  );
}

type CsvUploadBoxProps = {
  disabled: boolean;
  isDragging: boolean;
  isUploading: boolean;
  selectedFile: File | null;
  uploadError: string | null;
  onDragChange: (isDragging: boolean) => void;
  onFileSelect: (file: File | null) => void;
  onUpload: () => void;
};

function CsvUploadBox({
  disabled,
  isDragging,
  isUploading,
  selectedFile,
  uploadError,
  onDragChange,
  onFileSelect,
  onUpload,
}: CsvUploadBoxProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label
        htmlFor="csv-file"
        onDragEnter={(event) => {
          event.preventDefault();
          onDragChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragChange(true);
        }}
        onDragLeave={() => onDragChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDragChange(false);
          onFileSelect(event.dataTransfer.files.item(0));
        }}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center ${
          isDragging
            ? 'border-slate-900 bg-white'
            : 'border-slate-300 bg-white hover:border-slate-400'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          CSV
        </span>
        <span className="mt-3 text-sm font-semibold text-slate-900">
          {selectedFile ? selectedFile.name : 'Choose a CSV file'}
        </span>
        <span className="mt-1 text-sm text-slate-600">Orders or products, up to 25 MB</span>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => onFileSelect(event.target.files?.item(0) ?? null)}
        />
      </label>

      {selectedFile && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-slate-700">{selectedFile.name}</span>
          <span className="shrink-0 text-slate-500">{formatFileSize(selectedFile.size)}</span>
        </div>
      )}

      {uploadError && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {uploadError}
        </div>
      )}

      <button
        type="button"
        disabled={disabled || !selectedFile || isUploading}
        onClick={onUpload}
        className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isUploading ? 'Importing...' : 'Import CSV'}
      </button>
    </div>
  );
}

type ImportResultPanelProps = {
  data: ImportDisplayData | null;
  isLoadingDetail: boolean;
};

function ImportResultPanel({ data, isLoadingDetail }: ImportResultPanelProps) {
  if (isLoadingDetail) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-500">Import result</p>
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Loading import report...
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-500">Import result</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">No import selected</h3>
        <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          Results and row-level issues will appear here.
        </div>
      </section>
    );
  }

  const issueCount = data.errors.length + data.warnings.length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Import result</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">{formatImportType(data.importType)}</h3>
          {data.fileName && <p className="mt-1 text-sm text-slate-600">{data.fileName}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(data.status)}`}>
          {formatStatus(data.status)}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <ImportMetric label="Rows" value={data.rowsTotal} />
        <ImportMetric label="Imported" value={data.rowsImported} />
        <ImportMetric label="Failed" value={data.rowsFailed} />
      </dl>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Issues</h4>
          <span className="text-sm text-slate-500">{issueCount}</span>
        </div>

        {issueCount === 0 ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            No row issues found.
          </div>
        ) : (
          <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
            {[...data.errors, ...data.warnings].map((issue, index) => (
              <div
                key={`${issue.severity}-${issue.row}-${issue.column ?? 'row'}-${index}`}
                className={`rounded-md border px-3 py-2 text-sm ${
                  issue.severity === 'error'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span>{issue.severity === 'error' ? 'Error' : 'Warning'}</span>
                  <span>Row {issue.row}</span>
                  {issue.column && <span>{issue.column}</span>}
                </div>
                <p className="mt-1">{issue.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-slate-900">{value}</dd>
    </div>
  );
}

type ImportHistoryProps = {
  jobs: ImportJobSummary[];
  isLoading: boolean;
  error: string | null;
  selectedJobId: string | null;
  onJobSelect: (jobId: string) => void;
};

function ImportHistory({ jobs, isLoading, error, selectedJobId, onJobSelect }: ImportHistoryProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Import history</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Recent jobs</h3>
        </div>
        <span className="text-sm text-slate-500">{jobs.length}</span>
      </div>

      {isLoading && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Loading history...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && jobs.length === 0 && (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          No imports yet.
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mt-4 space-y-2">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => onJobSelect(job.id)}
              className={`w-full rounded-md border px-3 py-3 text-left transition ${
                selectedJobId === job.id
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{job.fileName}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatImportType(job.importType)} / {formatDate(job.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                    job.status,
                  )}`}
                >
                  {formatStatus(job.status)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                <span>{job.rowsTotal} rows</span>
                <span>{job.rowsImported} imported</span>
                <span>{job.rowsFailed} failed</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function isCsvFile(file: File): boolean {
  return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatImportType(value: ImportType): string {
  const labels: Record<ImportType, string> = {
    ORDERS: 'Orders',
    PRODUCTS: 'Products',
    INVENTORY: 'Inventory',
  };

  return labels[value];
}

function formatStatus(value: ImportStatus): string {
  const labels: Record<ImportStatus, string> = {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    COMPLETED_WITH_WARNINGS: 'Warnings',
    FAILED: 'Failed',
  };

  return labels[value];
}

function getStatusClass(value: ImportStatus): string {
  if (value === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (value === 'COMPLETED_WITH_WARNINGS') {
    return 'bg-amber-100 text-amber-700';
  }

  if (value === 'FAILED') {
    return 'bg-red-100 text-red-700';
  }

  return 'bg-slate-100 text-slate-700';
}
