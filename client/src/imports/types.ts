export type ImportType = 'ORDERS' | 'PRODUCTS' | 'INVENTORY';

export type ImportStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED';

export type ImportMode = Extract<ImportType, 'ORDERS' | 'PRODUCTS'>;

export type ImportIssueSeverity = 'error' | 'warning';

export type ImportIssue = {
  row: number;
  column?: string;
  message: string;
  severity: ImportIssueSeverity;
};

export type ImportResult = {
  jobId: string;
  importType: ImportType;
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export type ImportJobSummary = {
  id: string;
  fileName: string;
  importType: ImportType;
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  createdAt: string;
};

export type ImportJobDetail = ImportJobSummary & {
  errorSummary: {
    errors: ImportIssue[];
    warnings: ImportIssue[];
  };
};

export type ImportJobsResponse = {
  data: ImportJobSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
