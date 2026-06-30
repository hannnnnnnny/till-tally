import { readFile } from 'node:fs/promises';
import { ImportStatus, ImportType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import {
  type CsvIssue,
  type CsvValidationResult,
  type ProductImportRow,
  validateProductsCsv,
} from './csvValidation';
import { type UploadedCsvFile } from './uploadMiddleware';

export type ImportProductsInput = {
  businessId: string;
  uploadedFile: UploadedCsvFile;
};

export type ImportProductsResult = {
  jobId: string;
  importType: ImportType;
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  errors: CsvIssue[];
  warnings: CsvIssue[];
};

type ProductImportPlan = {
  products: ProductImportRow[];
  errors: CsvIssue[];
  warnings: CsvIssue[];
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
};

export async function importProductsCsvFile(
  input: ImportProductsInput,
): Promise<ImportProductsResult> {
  const csvText = await readFile(input.uploadedFile.path, 'utf8');
  const validation = validateProductsCsv(csvText);
  const plan = buildProductImportPlan(validation);
  const importJob = await createImportJobWithProducts(
    input.businessId,
    input.uploadedFile.originalName,
    plan,
  );

  return {
    jobId: importJob.id,
    importType: ImportType.PRODUCTS,
    status: importJob.status,
    rowsTotal: importJob.rowsTotal,
    rowsImported: importJob.rowsImported,
    rowsFailed: importJob.rowsFailed,
    errors: plan.errors,
    warnings: plan.warnings,
  };
}

export function buildProductImportPlan(
  validation: CsvValidationResult<ProductImportRow>,
): ProductImportPlan {
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];
  const products: ProductImportRow[] = [];
  const seenSkus = new Set<string>();

  if (validation.rowsTotal === 0) {
    errors.push({
      row: 1,
      message: 'CSV must include at least one product row',
      severity: 'error',
    });
  }

  for (const row of validation.validRows) {
    if (seenSkus.has(row.sku)) {
      warnings.push({
        row: row.sourceRow,
        column: 'sku',
        message: 'Duplicate SKU in CSV; row skipped',
        severity: 'warning',
      });
      continue;
    }

    seenSkus.add(row.sku);
    products.push(row);
  }

  const rowsImported = products.length;
  const rowsFailed = validation.rowsTotal - rowsImported;
  const status =
    rowsImported === 0
      ? ImportStatus.FAILED
      : errors.length > 0 || warnings.length > 0
        ? ImportStatus.COMPLETED_WITH_WARNINGS
        : ImportStatus.COMPLETED;

  return {
    products,
    errors,
    warnings,
    status,
    rowsTotal: validation.rowsTotal,
    rowsImported,
    rowsFailed,
  };
}

async function createImportJobWithProducts(
  businessId: string,
  fileName: string,
  plan: ProductImportPlan,
): Promise<{
  id: string;
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
}> {
  return prisma.$transaction(async (tx) => {
    const importJob = await tx.importJob.create({
      data: {
        businessId,
        fileName,
        importType: ImportType.PRODUCTS,
        status: plan.status,
        rowsTotal: plan.rowsTotal,
        rowsImported: plan.rowsImported,
        rowsFailed: plan.rowsFailed,
        errorSummary: buildErrorSummary(plan),
      },
      select: {
        id: true,
        status: true,
        rowsTotal: true,
        rowsImported: true,
        rowsFailed: true,
      },
    });

    for (const product of plan.products) {
      await upsertProduct(tx, businessId, importJob.id, product);
    }

    return importJob;
  });
}

async function upsertProduct(
  tx: Prisma.TransactionClient,
  businessId: string,
  importJobId: string,
  product: ProductImportRow,
): Promise<void> {
  await tx.product.upsert({
    where: {
      businessId_sku: {
        businessId,
        sku: product.sku,
      },
    },
    create: {
      businessId,
      importJobId,
      sku: product.sku,
      name: product.name,
      category: product.category,
      vendor: product.vendor,
      costPrice: toMoney(product.costPrice),
      currentStock: product.currentStock,
      lastSoldAt: toOptionalDate(product.lastSoldAt),
    },
    update: {
      importJobId,
      name: product.name,
      category: product.category,
      vendor: product.vendor,
      costPrice: toMoney(product.costPrice),
      currentStock: product.currentStock,
      lastSoldAt: toOptionalDate(product.lastSoldAt),
    },
  });
}

function buildErrorSummary(plan: ProductImportPlan): Prisma.InputJsonValue | undefined {
  if (plan.errors.length === 0 && plan.warnings.length === 0) {
    return undefined;
  }

  return {
    errors: plan.errors,
    warnings: plan.warnings,
  };
}

function toOptionalDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toMoney(value: number): string {
  return value.toFixed(2);
}
