import { readFile } from 'node:fs/promises';
import { ImportStatus, ImportType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import {
  type CsvIssue,
  type OrderImportItemRow,
  type OrderImportRow,
  type CsvValidationResult,
  validateOrdersCsv,
} from './csvValidation';
import { type UploadedCsvFile } from './uploadMiddleware';

export type ImportOrdersInput = {
  businessId: string;
  uploadedFile: UploadedCsvFile;
};

export type ImportOrdersResult = {
  jobId: string;
  importType: ImportType;
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  errors: CsvIssue[];
  warnings: CsvIssue[];
};

type PlannedOrderItem = OrderImportItemRow & {
  productId: string | null;
};

type PlannedOrder = Omit<OrderImportRow, 'item'> & {
  item: PlannedOrderItem | null;
};

type OrderImportPlan = {
  orders: PlannedOrder[];
  errors: CsvIssue[];
  warnings: CsvIssue[];
  status: ImportStatus;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
};

export async function importOrdersCsvFile(input: ImportOrdersInput): Promise<ImportOrdersResult> {
  const csvText = await readFile(input.uploadedFile.path, 'utf8');
  const validation = validateOrdersCsv(csvText);

  const orderNumbers = validation.validRows.map((row) => row.orderNumber);
  const existingOrderNumbers = await findExistingOrderNumbers(input.businessId, orderNumbers);
  const productsBySku = await findProductsBySku(input.businessId, validation.validRows);
  const plan = buildOrderImportPlan(validation, existingOrderNumbers, productsBySku);
  const importJob = await createImportJobWithOrders(
    input.businessId,
    input.uploadedFile.originalName,
    plan,
  );

  return {
    jobId: importJob.id,
    importType: ImportType.ORDERS,
    status: importJob.status,
    rowsTotal: importJob.rowsTotal,
    rowsImported: importJob.rowsImported,
    rowsFailed: importJob.rowsFailed,
    errors: plan.errors,
    warnings: plan.warnings,
  };
}

export function buildOrderImportPlan(
  validation: CsvValidationResult<OrderImportRow>,
  existingOrderNumbers: Set<string>,
  productsBySku: Map<string, string>,
): OrderImportPlan {
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];
  const orders: PlannedOrder[] = [];

  if (validation.rowsTotal === 0) {
    errors.push({
      row: 1,
      message: 'CSV must include at least one order row',
      severity: 'error',
    });
  }

  for (const row of validation.validRows) {
    if (existingOrderNumbers.has(row.orderNumber)) {
      warnings.push({
        row: row.sourceRow,
        column: 'order_number',
        message: 'Order number already exists; row skipped',
        severity: 'warning',
      });
      continue;
    }

    let plannedItem: PlannedOrderItem | null = null;

    if (row.item) {
      const productId = productsBySku.get(row.item.sku) ?? null;

      if (!productId) {
        warnings.push({
          row: row.sourceRow,
          column: 'sku',
          message: `SKU "${row.item.sku}" was not matched to a product`,
          severity: 'warning',
        });
      }

      plannedItem = {
        ...row.item,
        productId,
      };
    }

    orders.push({
      ...row,
      item: plannedItem,
    });
  }

  const rowsImported = orders.length;
  const rowsFailed = validation.rowsTotal - rowsImported;
  const status =
    rowsImported === 0
      ? ImportStatus.FAILED
      : errors.length > 0 || warnings.length > 0
        ? ImportStatus.COMPLETED_WITH_WARNINGS
        : ImportStatus.COMPLETED;

  return {
    orders,
    errors,
    warnings,
    status,
    rowsTotal: validation.rowsTotal,
    rowsImported,
    rowsFailed,
  };
}

async function findExistingOrderNumbers(
  businessId: string,
  orderNumbers: string[],
): Promise<Set<string>> {
  if (orderNumbers.length === 0) {
    return new Set<string>();
  }

  const existingOrders = await prisma.order.findMany({
    where: {
      businessId,
      orderNumber: {
        in: orderNumbers,
      },
    },
    select: {
      orderNumber: true,
    },
  });

  return new Set(existingOrders.map((order) => order.orderNumber));
}

async function findProductsBySku(
  businessId: string,
  rows: OrderImportRow[],
): Promise<Map<string, string>> {
  const itemSkus = rows
    .map((row) => row.item?.sku)
    .filter((sku): sku is string => typeof sku === 'string');

  if (itemSkus.length === 0) {
    return new Map<string, string>();
  }

  const products = await prisma.product.findMany({
    where: {
      businessId,
      sku: {
        in: [...new Set(itemSkus)],
      },
    },
    select: {
      id: true,
      sku: true,
    },
  });

  return new Map(products.map((product) => [product.sku, product.id]));
}

async function createImportJobWithOrders(
  businessId: string,
  fileName: string,
  plan: OrderImportPlan,
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
        importType: ImportType.ORDERS,
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

    for (const order of plan.orders) {
      await createOrder(tx, businessId, importJob.id, order);
    }

    return importJob;
  });
}

async function createOrder(
  tx: Prisma.TransactionClient,
  businessId: string,
  importJobId: string,
  order: PlannedOrder,
): Promise<void> {
  await tx.order.create({
    data: {
      businessId,
      importJobId,
      orderNumber: order.orderNumber,
      orderDate: toDate(order.orderDate),
      channel: order.channel,
      totalAmount: toMoney(order.totalAmount),
      discountAmount: toMoney(order.discountAmount),
      customerRegion: order.customerRegion,
      ...(order.item
        ? {
            items: {
              create: buildOrderItemCreateInput(order.item),
            },
          }
        : {}),
    },
  });
}

function buildOrderItemCreateInput(
  item: PlannedOrderItem,
): Prisma.OrderItemCreateWithoutOrderInput {
  return {
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: toMoney(item.unitPrice),
    totalPrice: toMoney(item.totalPrice),
    costPrice: toMoney(item.costPrice),
    ...(item.productId
      ? {
          product: {
            connect: {
              id: item.productId,
            },
          },
        }
      : {}),
  };
}

function buildErrorSummary(plan: OrderImportPlan): Prisma.InputJsonValue | undefined {
  if (plan.errors.length === 0 && plan.warnings.length === 0) {
    return undefined;
  }

  return {
    errors: plan.errors,
    warnings: plan.warnings,
  };
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toMoney(value: number): string {
  return value.toFixed(2);
}
