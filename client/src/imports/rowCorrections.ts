import {
  createMappedCsvData,
  type ColumnMapping,
  type CsvPreview,
  type ImportFieldDefinition,
} from './preview';
import { type PreflightValidation } from './rowValidation';
import { type ImportMode } from './types';

// Keyed by data row index, then by source header, so corrections survive remapping columns.
export type CellCorrections = Readonly<Record<number, Readonly<Record<string, string>>>>;

export type RowEditorField = ImportFieldDefinition & {
  sourceHeader: string;
  value: string;
  issues: string[];
};

export type FailedRowEditor = {
  rowIndex: number;
  rowNumber: number;
  fields: RowEditorField[];
};

export function setCellCorrection(
  corrections: CellCorrections,
  preview: CsvPreview,
  rowIndex: number,
  sourceHeader: string,
  value: string,
): CellCorrections {
  const columnIndex = preview.headers.indexOf(sourceHeader);
  const originalRow = preview.dataRows[rowIndex];

  if (columnIndex < 0 || !originalRow) {
    return corrections;
  }

  const otherCells = omitKey(corrections[rowIndex] ?? {}, sourceHeader);
  const trimmedValue = value.trim();
  const rowCells =
    trimmedValue === originalRow[columnIndex]
      ? otherCells
      : { ...otherCells, [sourceHeader]: trimmedValue };
  const otherRows = omitKey(corrections, String(rowIndex));

  return Object.keys(rowCells).length > 0 ? { ...otherRows, [rowIndex]: rowCells } : otherRows;
}

export function applyCellCorrections(
  preview: CsvPreview,
  corrections: CellCorrections,
): CsvPreview {
  if (countCorrectedRows(corrections) === 0) {
    return preview;
  }

  const dataRows = preview.dataRows.map((row, rowIndex) => {
    const rowCorrections = corrections[rowIndex];

    if (!rowCorrections) {
      return row;
    }

    return row.map((value, columnIndex) => {
      const header = preview.headers[columnIndex] ?? '';
      return rowCorrections[header] ?? value;
    });
  });

  return {
    ...preview,
    dataRows,
    previewRows: dataRows.slice(0, preview.previewRows.length),
  };
}

export function getFailedRowEditors(
  preview: CsvPreview,
  mode: ImportMode,
  mapping: ColumnMapping,
  validation: PreflightValidation,
): FailedRowEditor[] {
  const mappedCsv = createMappedCsvData(preview, mode, mapping);

  return mappedCsv.rows
    .filter((row) => validation.failedRowIndexes.has(row.rowIndex))
    .map((row) => ({
      rowIndex: row.rowIndex,
      rowNumber: row.sourceRowNumber,
      fields: mappedCsv.fields.map((field) => ({
        ...field,
        sourceHeader: mapping[field.key] ?? '',
        value: row.valuesByField[field.key] ?? '',
        issues: validation.issues
          .filter(
            (issue) =>
              issue.rowIndex === row.rowIndex &&
              issue.column === field.key &&
              issue.severity === 'error',
          )
          .map((issue) => issue.message),
      })),
    }));
}

export function countCorrectedRows(corrections: CellCorrections): number {
  return Object.keys(corrections).length;
}

function omitKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
}
