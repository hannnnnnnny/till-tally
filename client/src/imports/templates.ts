import { type ColumnMapping, type CsvPreview } from './preview';
import { type ImportMode } from './types';

export type ImportMappingTemplate = {
  id: string;
  businessId: string;
  importType: ImportMode;
  name: string;
  sourceHeaders: string[];
  mappedFields: ColumnMapping;
  createdAt: string;
  updatedAt: string;
};

type SaveImportMappingTemplateInput = {
  businessId: string;
  importType: ImportMode;
  name: string;
  sourceHeaders: string[];
  mappedFields: ColumnMapping;
  templateId?: string;
};

const STORAGE_KEY = 'till-tally.import-mapping-templates.v1';

export function listImportMappingTemplates(
  businessId: string,
  importType: ImportMode,
): ImportMappingTemplate[] {
  return readTemplates()
    .filter((template) => template.businessId === businessId && template.importType === importType)
    .sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
}

export function saveImportMappingTemplate(
  input: SaveImportMappingTemplateInput,
): ImportMappingTemplate {
  const templates = readTemplates();
  const now = new Date().toISOString();
  const existingTemplate = input.templateId
    ? templates.find((template) => template.id === input.templateId)
    : null;
  const nextTemplate: ImportMappingTemplate = {
    id: existingTemplate?.id ?? createTemplateId(),
    businessId: input.businessId,
    importType: input.importType,
    name: input.name.trim(),
    sourceHeaders: [...input.sourceHeaders],
    mappedFields: { ...input.mappedFields },
    createdAt: existingTemplate?.createdAt ?? now,
    updatedAt: now,
  };
  const nextTemplates = [
    nextTemplate,
    ...templates.filter((template) => template.id !== nextTemplate.id),
  ];

  writeTemplates(nextTemplates);

  return nextTemplate;
}

export function findMatchingImportMappingTemplate(
  templates: ImportMappingTemplate[],
  headers: string[],
): ImportMappingTemplate | null {
  const headerSignature = createHeaderSignature(headers);

  return (
    templates.find(
      (template) => createHeaderSignature(template.sourceHeaders) === headerSignature,
    ) ?? null
  );
}

export function applyImportMappingTemplate(
  template: ImportMappingTemplate,
  preview: CsvPreview,
): ColumnMapping {
  const headerByNormalizedName = new Map(
    preview.headers.map((header) => [normalizeHeader(header), header]),
  );

  return Object.fromEntries(
    Object.entries(template.mappedFields).flatMap(([fieldKey, sourceHeader]) => {
      const nextSourceHeader =
        preview.headers.find((header) => header === sourceHeader) ??
        headerByNormalizedName.get(normalizeHeader(sourceHeader));

      if (!nextSourceHeader) {
        return [];
      }

      return [[fieldKey, nextSourceHeader]];
    }),
  );
}

function readTemplates(): ImportMappingTemplate[] {
  try {
    const storedTemplates = window.localStorage.getItem(STORAGE_KEY);

    if (!storedTemplates) {
      return [];
    }

    const parsedTemplates: unknown = JSON.parse(storedTemplates);

    if (!Array.isArray(parsedTemplates)) {
      return [];
    }

    return parsedTemplates.filter(isImportMappingTemplate);
  } catch {
    return [];
  }
}

function writeTemplates(templates: ImportMappingTemplate[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function isImportMappingTemplate(value: unknown): value is ImportMappingTemplate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.businessId === 'string' &&
    isImportMode(value.importType) &&
    typeof value.name === 'string' &&
    Array.isArray(value.sourceHeaders) &&
    value.sourceHeaders.every((header) => typeof header === 'string') &&
    isColumnMapping(value.mappedFields) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isColumnMapping(value: unknown): value is ColumnMapping {
  return (
    isRecord(value) &&
    Object.values(value).every((mappedHeader) => typeof mappedHeader === 'string')
  );
}

function isImportMode(value: unknown): value is ImportMode {
  return value === 'ORDERS' || value === 'PRODUCTS';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createHeaderSignature(headers: string[]): string {
  return headers.map(normalizeHeader).sort().join('\u001f');
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function createTemplateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
