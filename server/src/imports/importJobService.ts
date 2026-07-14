import { type ImportStatus, type ImportType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type ImportJobPaginationQuery = {
  page?: unknown;
  pageSize?: unknown;
};

type ImportJobPagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

type ImportJobRecord = {
  id: string;
  fileName: string;
  importType: ImportType;
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  errorSummary?: Prisma.JsonValue | null;
  createdAt: Date;
};

export type ImportJobIssueSeverity = 'error' | 'warning';

export type ImportJobIssue = {
  row: number;
  column?: string;
  message: string;
  severity: ImportJobIssueSeverity;
};

export type ImportJobErrorSummary = {
  errors: ImportJobIssue[];
  warnings: ImportJobIssue[];
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
  errorSummary: ImportJobErrorSummary;
};

export type ImportJobsListResult = {
  data: ImportJobSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function parseImportJobPagination(query: ImportJobPaginationQuery): ImportJobPagination {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
  const requestedPageSize = parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export async function listImportJobs(
  businessId: string,
  pagination: ImportJobPagination,
): Promise<ImportJobsListResult> {
  const [total, jobs] = await prisma.$transaction([
    prisma.importJob.count({
      where: {
        businessId,
      },
    }),
    prisma.importJob.findMany({
      where: {
        businessId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: pagination.skip,
      take: pagination.take,
      select: importJobSummarySelect,
    }),
  ]);

  return {
    data: jobs.map(toImportJobSummary),
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  };
}

export async function getImportJobDetail(
  businessId: string,
  jobId: string,
): Promise<ImportJobDetail | null> {
  const job = await prisma.importJob.findFirst({
    where: {
      id: jobId,
      businessId,
    },
    select: importJobDetailSelect,
  });

  if (!job) {
    return null;
  }

  return {
    ...toImportJobSummary(job),
    errorSummary: normalizeImportJobErrorSummary(job.errorSummary),
  };
}

export function normalizeImportJobErrorSummary(
  value: Prisma.JsonValue | null,
): ImportJobErrorSummary {
  if (!isRecord(value)) {
    return createEmptyErrorSummary();
  }

  return {
    errors: normalizeIssueList(value.errors, 'error'),
    warnings: normalizeIssueList(value.warnings, 'warning'),
  };
}

const importJobSummarySelect = {
  id: true,
  fileName: true,
  importType: true,
  status: true,
  rowsTotal: true,
  rowsImported: true,
  rowsFailed: true,
  createdAt: true,
} satisfies Prisma.ImportJobSelect;

const importJobDetailSelect = {
  ...importJobSummarySelect,
  errorSummary: true,
} satisfies Prisma.ImportJobSelect;

function toImportJobSummary(job: ImportJobRecord): ImportJobSummary {
  return {
    id: job.id,
    fileName: job.fileName,
    importType: job.importType,
    status: job.status,
    rowsTotal: job.rowsTotal,
    rowsImported: job.rowsImported,
    rowsFailed: job.rowsFailed,
    createdAt: job.createdAt.toISOString(),
  };
}

function normalizeIssueList(
  value: unknown,
  fallbackSeverity: ImportJobIssueSeverity,
): ImportJobIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((issue) => normalizeIssue(issue, fallbackSeverity))
    .filter((issue): issue is ImportJobIssue => issue !== null);
}

function normalizeIssue(
  value: unknown,
  fallbackSeverity: ImportJobIssueSeverity,
): ImportJobIssue | null {
  if (!isRecord(value)) {
    return null;
  }

  const row = value.row;
  const message = value.message;

  if (typeof row !== 'number' || !Number.isFinite(row) || typeof message !== 'string') {
    return null;
  }

  const column = typeof value.column === 'string' ? value.column : undefined;
  const severity = isIssueSeverity(value.severity) ? value.severity : fallbackSeverity;

  return {
    row,
    ...(column ? { column } : {}),
    message,
    severity,
  };
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const rawValue = readFirstQueryValue(value);

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function readFirstQueryValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIssueSeverity(value: unknown): value is ImportJobIssueSeverity {
  return value === 'error' || value === 'warning';
}

function createEmptyErrorSummary(): ImportJobErrorSummary {
  return {
    errors: [],
    warnings: [],
  };
}
