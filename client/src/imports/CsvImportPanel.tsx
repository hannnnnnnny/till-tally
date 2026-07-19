import { useEffect, useMemo, useState } from 'react';
import { useBusinesses } from '../businesses/BusinessContext';
import { fetchImportJobDetail, fetchImportJobs, uploadImportCsv } from './api';
import {
  type ImportIssue,
  type ImportIssueSeverity,
  type ImportJobDetail,
  type ImportJobSummary,
  type ImportMode,
  type ImportResult,
  type ImportStatus,
  type ImportType,
} from './types';
import {
  createDefaultColumnMapping,
  createCsvPreview,
  createMappedCsvFile,
  getImportFieldDefinitions,
  getMissingRequiredMappedFields,
  isImportablePreviewType,
  type ColumnMapping,
  type CsvPreview,
  type CsvPreviewDetectedType,
  type ImportFieldDefinition,
} from './preview';
import {
  createMappingSuggestions,
  mergeSuggestionsIntoMapping,
  type MappingSuggestion,
} from './mappingSuggestions';
import {
  applyImportMappingTemplate,
  findMatchingImportMappingTemplate,
  listImportMappingTemplates,
  saveImportMappingTemplate,
  type ImportMappingTemplate,
} from './templates';
import { validateMappedCsvRows, type PreflightValidation } from './rowValidation';
import { PageHeader, Surface } from '../ui/PageLayout';
import { InlineNotice, StatePanel } from '../ui/StatePanel';

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
  const { activeBusiness, activeBusinessHeaders, activeBusinessId } = useBusinesses();
  const [mode, setMode] = useState<ImportMode>('ORDERS');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [mappingTemplates, setMappingTemplates] = useState<ImportMappingTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [ignoredTemplateId, setIgnoredTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null);
  const [skipInvalidRowsConfirmed, setSkipInvalidRowsConfirmed] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
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

  const missingRequiredFields = useMemo(
    () => (csvPreview ? getMissingRequiredMappedFields(columnMapping, mode) : []),
    [columnMapping, csvPreview, mode],
  );

  const preflightValidation = useMemo(() => {
    if (
      !csvPreview ||
      csvPreview.detectedType === 'INVENTORY' ||
      missingRequiredFields.length > 0
    ) {
      return null;
    }

    return validateMappedCsvRows(csvPreview, mode, columnMapping);
  }, [columnMapping, csvPreview, missingRequiredFields.length, mode]);

  const suggestedTemplate = useMemo(() => {
    if (!csvPreview) {
      return null;
    }

    const matchingTemplate = findMatchingImportMappingTemplate(
      mappingTemplates,
      csvPreview.headers,
    );

    if (!matchingTemplate || matchingTemplate.id === ignoredTemplateId) {
      return null;
    }

    return matchingTemplate;
  }, [csvPreview, ignoredTemplateId, mappingTemplates]);

  const mappingSuggestions = useMemo(
    () => (csvPreview ? createMappingSuggestions(csvPreview, mode) : []),
    [csvPreview, mode],
  );

  useEffect(() => {
    let isActive = true;

    async function loadPreview() {
      if (!selectedFile) {
        setCsvPreview(null);
        setPreviewError(null);
        setIsPreviewing(false);
        return;
      }

      setIsPreviewing(true);
      setCsvPreview(null);
      setPreviewError(null);

      try {
        const nextPreview = await createCsvPreview(selectedFile);

        if (!isActive) {
          return;
        }

        setCsvPreview(nextPreview);

        if (isImportablePreviewType(nextPreview.detectedType)) {
          setMode(nextPreview.detectedType);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setPreviewError(error instanceof Error ? error.message : 'Unable to preview CSV');
      } finally {
        if (isActive) {
          setIsPreviewing(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isActive = false;
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!activeBusinessId) {
      setMappingTemplates([]);
      setActiveTemplateId(null);
      setIgnoredTemplateId(null);
      setTemplateNotice(null);
      return;
    }

    setMappingTemplates(listImportMappingTemplates(activeBusinessId, mode));
    setActiveTemplateId(null);
    setIgnoredTemplateId(null);
    setTemplateNotice(null);
  }, [activeBusinessId, mode]);

  useEffect(() => {
    if (!csvPreview) {
      setColumnMapping({});
      setActiveTemplateId(null);
      setTemplateName('');
      setTemplateNotice(null);
      setSuggestionNotice(null);
      return;
    }

    const matchingTemplate = findMatchingImportMappingTemplate(
      mappingTemplates,
      csvPreview.headers,
    );

    if (matchingTemplate && matchingTemplate.id !== ignoredTemplateId) {
      setColumnMapping(applyImportMappingTemplate(matchingTemplate, csvPreview));
      setActiveTemplateId(matchingTemplate.id);
      setTemplateName(matchingTemplate.name);
      setTemplateNotice(`Using saved template "${matchingTemplate.name}"`);
      return;
    }

    setColumnMapping(createDefaultColumnMapping(csvPreview, mode));
    setActiveTemplateId(null);
    setTemplateName(getDefaultTemplateName(mode, csvPreview.fileName));
    setTemplateNotice(null);
    setSuggestionNotice(null);
  }, [csvPreview, ignoredTemplateId, mappingTemplates, mode]);

  useEffect(() => {
    setSkipInvalidRowsConfirmed(false);
  }, [columnMapping, csvPreview, mode]);

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
    setSkipInvalidRowsConfirmed(false);

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

    if (isPreviewing) {
      setUploadError('CSV preview is still loading');
      return;
    }

    if (previewError) {
      setUploadError(previewError);
      return;
    }

    if (!csvPreview) {
      setUploadError('Preview the CSV before importing');
      return;
    }

    if (csvPreview.detectedType === 'INVENTORY') {
      setUploadError(
        'Inventory CSV preview is supported, but inventory import is not available yet',
      );
      return;
    }

    if (missingRequiredFields.length > 0) {
      setUploadError(
        `Map required fields before importing: ${missingRequiredFields
          .map((field) => field.label)
          .join(', ')}`,
      );
      return;
    }

    if (preflightValidation && preflightValidation.failedRows > 0 && !skipInvalidRowsConfirmed) {
      setUploadError(
        'Review failed rows before importing. Skip invalid rows or cancel the import.',
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setSelectedJobDetail(null);

    try {
      const mappedFile = createMappedCsvFile(csvPreview, mode, columnMapping);
      const result = await uploadImportCsv(mode, mappedFile, activeBusinessHeaders);
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

  function handleSkipInvalidRows() {
    setSkipInvalidRowsConfirmed(true);
    setUploadError(null);
  }

  function handleCancelImport() {
    handleFileSelection(null);
  }

  function handleUseTemplate(template: ImportMappingTemplate) {
    if (!csvPreview) {
      return;
    }

    setColumnMapping(applyImportMappingTemplate(template, csvPreview));
    setActiveTemplateId(template.id);
    setIgnoredTemplateId(null);
    setTemplateName(template.name);
    setTemplateNotice(`Using saved template "${template.name}"`);
    setUploadError(null);
  }

  function handleIgnoreTemplate(template: ImportMappingTemplate) {
    if (!csvPreview) {
      return;
    }

    setIgnoredTemplateId(template.id);
    setActiveTemplateId(null);
    setColumnMapping(createDefaultColumnMapping(csvPreview, mode));
    setTemplateName(getDefaultTemplateName(mode, csvPreview.fileName));
    setTemplateNotice(null);
    setUploadError(null);
  }

  function handleSaveTemplate() {
    if (!activeBusinessId || !csvPreview) {
      return;
    }

    if (missingRequiredFields.length > 0) {
      setUploadError('Map required fields before saving a template');
      return;
    }

    const savedTemplate = saveImportMappingTemplate({
      businessId: activeBusinessId,
      importType: mode,
      mappedFields: columnMapping,
      name: templateName.trim() || getDefaultTemplateName(mode, csvPreview.fileName),
      sourceHeaders: csvPreview.headers,
      templateId: activeTemplateId ?? undefined,
    });

    setMappingTemplates(listImportMappingTemplates(activeBusinessId, mode));
    setActiveTemplateId(savedTemplate.id);
    setIgnoredTemplateId(null);
    setTemplateName(savedTemplate.name);
    setTemplateNotice(
      activeTemplateId
        ? `Updated template "${savedTemplate.name}"`
        : `Saved template "${savedTemplate.name}"`,
    );
    setUploadError(null);
  }

  function handleApplyMappingSuggestions() {
    if (mappingSuggestions.length === 0) {
      return;
    }

    setColumnMapping((currentMapping) =>
      mergeSuggestionsIntoMapping(currentMapping, mappingSuggestions),
    );
    setActiveTemplateId(null);
    setTemplateNotice(null);
    setSuggestionNotice('Suggestions applied. Review mappings before importing.');
    setUploadError(null);
  }

  return (
    <Surface>
      <PageHeader
        eyebrow="Data import"
        title="CSV imports"
        description={activeBusiness ? activeBusiness.name : 'Select a business to import data'}
        actions={
          <div className="grid w-full grid-cols-2 rounded-md bg-slate-100 p-1 sm:w-56">
            {IMPORT_MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={`min-h-10 rounded px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  mode === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {!activeBusinessHeaders && (
        <InlineNotice tone="warning" className="mt-5">
          Create or select a business before importing CSV data.
        </InlineNotice>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className="space-y-6">
          <CsvUploadBox
            activeTemplateId={activeTemplateId}
            disabled={!activeBusinessHeaders || isUploading}
            columnMapping={columnMapping}
            csvPreview={csvPreview}
            isDragging={isDragging}
            isPreviewing={isPreviewing}
            isUploading={isUploading}
            mappingSuggestions={mappingSuggestions}
            missingRequiredFields={missingRequiredFields}
            mode={mode}
            preflightValidation={preflightValidation}
            previewError={previewError}
            selectedFile={selectedFile}
            skipInvalidRowsConfirmed={skipInvalidRowsConfirmed}
            suggestedTemplate={suggestedTemplate}
            suggestionNotice={suggestionNotice}
            templateName={templateName}
            templateNotice={templateNotice}
            onColumnMappingChange={setColumnMapping}
            uploadError={uploadError}
            onApplyMappingSuggestions={handleApplyMappingSuggestions}
            onCancelImport={handleCancelImport}
            onDragChange={setIsDragging}
            onFileSelect={handleFileSelection}
            onIgnoreTemplate={handleIgnoreTemplate}
            onSaveTemplate={handleSaveTemplate}
            onSkipInvalidRows={handleSkipInvalidRows}
            onTemplateNameChange={setTemplateName}
            onUseTemplate={handleUseTemplate}
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
    </Surface>
  );
}

type CsvUploadBoxProps = {
  activeTemplateId: string | null;
  disabled: boolean;
  columnMapping: ColumnMapping;
  csvPreview: CsvPreview | null;
  isDragging: boolean;
  isPreviewing: boolean;
  isUploading: boolean;
  mappingSuggestions: MappingSuggestion[];
  missingRequiredFields: ImportFieldDefinition[];
  mode: ImportMode;
  preflightValidation: PreflightValidation | null;
  previewError: string | null;
  selectedFile: File | null;
  skipInvalidRowsConfirmed: boolean;
  suggestedTemplate: ImportMappingTemplate | null;
  suggestionNotice: string | null;
  templateName: string;
  templateNotice: string | null;
  uploadError: string | null;
  onColumnMappingChange: (mapping: ColumnMapping) => void;
  onApplyMappingSuggestions: () => void;
  onCancelImport: () => void;
  onDragChange: (isDragging: boolean) => void;
  onFileSelect: (file: File | null) => void;
  onIgnoreTemplate: (template: ImportMappingTemplate) => void;
  onSaveTemplate: () => void;
  onSkipInvalidRows: () => void;
  onTemplateNameChange: (name: string) => void;
  onUseTemplate: (template: ImportMappingTemplate) => void;
  onUpload: () => void;
};

function CsvUploadBox({
  activeTemplateId,
  disabled,
  columnMapping,
  csvPreview,
  isDragging,
  isPreviewing,
  isUploading,
  mappingSuggestions,
  missingRequiredFields,
  mode,
  preflightValidation,
  previewError,
  selectedFile,
  skipInvalidRowsConfirmed,
  suggestedTemplate,
  suggestionNotice,
  templateName,
  templateNotice,
  uploadError,
  onColumnMappingChange,
  onApplyMappingSuggestions,
  onCancelImport,
  onDragChange,
  onFileSelect,
  onIgnoreTemplate,
  onSaveTemplate,
  onSkipInvalidRows,
  onTemplateNameChange,
  onUseTemplate,
  onUpload,
}: CsvUploadBoxProps) {
  const hasUnconfirmedFailedRows =
    (preflightValidation?.failedRows ?? 0) > 0 && !skipInvalidRowsConfirmed;
  const canImport =
    !!selectedFile &&
    !!csvPreview &&
    !isPreviewing &&
    !previewError &&
    csvPreview.detectedType !== 'INVENTORY' &&
    missingRequiredFields.length === 0 &&
    !hasUnconfirmedFailedRows;

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

      {isPreviewing && (
        <InlineNotice tone="loading" className="mt-3 bg-white">
          Reading CSV preview...
        </InlineNotice>
      )}

      {previewError && (
        <InlineNotice tone="error" className="mt-3">
          {previewError}
        </InlineNotice>
      )}

      {csvPreview && (
        <CsvPreviewSummary
          activeTemplateId={activeTemplateId}
          columnMapping={columnMapping}
          mappingSuggestions={mappingSuggestions}
          missingRequiredFields={missingRequiredFields}
          mode={mode}
          preflightValidation={preflightValidation}
          preview={csvPreview}
          skipInvalidRowsConfirmed={skipInvalidRowsConfirmed}
          suggestedTemplate={suggestedTemplate}
          suggestionNotice={suggestionNotice}
          templateName={templateName}
          templateNotice={templateNotice}
          onColumnMappingChange={onColumnMappingChange}
          onApplyMappingSuggestions={onApplyMappingSuggestions}
          onCancelImport={onCancelImport}
          onIgnoreTemplate={onIgnoreTemplate}
          onSaveTemplate={onSaveTemplate}
          onSkipInvalidRows={onSkipInvalidRows}
          onTemplateNameChange={onTemplateNameChange}
          onUseTemplate={onUseTemplate}
        />
      )}

      {uploadError && (
        <InlineNotice tone="error" className="mt-3">
          {uploadError}
        </InlineNotice>
      )}

      <button
        type="button"
        disabled={disabled || !canImport || isUploading}
        onClick={onUpload}
        className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isUploading ? 'Importing...' : 'Confirm import'}
      </button>
    </div>
  );
}

type CsvPreviewSummaryProps = {
  activeTemplateId: string | null;
  columnMapping: ColumnMapping;
  mappingSuggestions: MappingSuggestion[];
  missingRequiredFields: ImportFieldDefinition[];
  mode: ImportMode;
  preflightValidation: PreflightValidation | null;
  preview: CsvPreview;
  skipInvalidRowsConfirmed: boolean;
  suggestedTemplate: ImportMappingTemplate | null;
  suggestionNotice: string | null;
  templateName: string;
  templateNotice: string | null;
  onColumnMappingChange: (mapping: ColumnMapping) => void;
  onApplyMappingSuggestions: () => void;
  onCancelImport: () => void;
  onIgnoreTemplate: (template: ImportMappingTemplate) => void;
  onSaveTemplate: () => void;
  onSkipInvalidRows: () => void;
  onTemplateNameChange: (name: string) => void;
  onUseTemplate: (template: ImportMappingTemplate) => void;
};

function CsvPreviewSummary({
  activeTemplateId,
  columnMapping,
  mappingSuggestions,
  missingRequiredFields,
  mode,
  preflightValidation,
  preview,
  skipInvalidRowsConfirmed,
  suggestedTemplate,
  suggestionNotice,
  templateName,
  templateNotice,
  onColumnMappingChange,
  onApplyMappingSuggestions,
  onCancelImport,
  onIgnoreTemplate,
  onSaveTemplate,
  onSkipInvalidRows,
  onTemplateNameChange,
  onUseTemplate,
}: CsvPreviewSummaryProps) {
  const notice = getPreviewNotice(preview.detectedType, mode);

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">CSV preview</p>
          <h3 className="mt-1 truncate text-base font-bold text-slate-900">{preview.fileName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {preview.rowsTotal} rows / {formatFileSize(preview.fileSize)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getConfidenceClass(preview.confidence)}`}
        >
          {formatDetectedImportType(preview.detectedType)}
        </span>
      </div>

      {notice && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            notice.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium uppercase text-slate-500">Headers</p>
        <div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-auto pr-1">
          {preview.headers.map((header, index) => (
            <span
              key={`${header}-${index}`}
              className="max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {header}
            </span>
          ))}
        </div>
      </div>

      <ImportTemplatePanel
        activeTemplateId={activeTemplateId}
        missingRequiredFields={missingRequiredFields}
        suggestedTemplate={suggestedTemplate}
        templateName={templateName}
        templateNotice={templateNotice}
        onIgnoreTemplate={onIgnoreTemplate}
        onSaveTemplate={onSaveTemplate}
        onTemplateNameChange={onTemplateNameChange}
        onUseTemplate={onUseTemplate}
      />

      <MappingSuggestionPanel
        suggestions={mappingSuggestions}
        suggestionNotice={suggestionNotice}
        onApplySuggestions={onApplyMappingSuggestions}
      />

      <ColumnMappingEditor
        mapping={columnMapping}
        missingRequiredFields={missingRequiredFields}
        mode={mode}
        preview={preview}
        onMappingChange={onColumnMappingChange}
      />

      <MappedPreviewTable mapping={columnMapping} mode={mode} preview={preview} />

      <PreflightValidationPanel
        isSkipConfirmed={skipInvalidRowsConfirmed}
        validation={preflightValidation}
        onCancelImport={onCancelImport}
        onSkipInvalidRows={onSkipInvalidRows}
      />
    </section>
  );
}

type ImportTemplatePanelProps = {
  activeTemplateId: string | null;
  missingRequiredFields: ImportFieldDefinition[];
  suggestedTemplate: ImportMappingTemplate | null;
  templateName: string;
  templateNotice: string | null;
  onIgnoreTemplate: (template: ImportMappingTemplate) => void;
  onSaveTemplate: () => void;
  onTemplateNameChange: (name: string) => void;
  onUseTemplate: (template: ImportMappingTemplate) => void;
};

function ImportTemplatePanel({
  activeTemplateId,
  missingRequiredFields,
  suggestedTemplate,
  templateName,
  templateNotice,
  onIgnoreTemplate,
  onSaveTemplate,
  onTemplateNameChange,
  onUseTemplate,
}: ImportTemplatePanelProps) {
  const isUsingSuggestedTemplate = suggestedTemplate?.id === activeTemplateId;
  const canSaveTemplate = templateName.trim().length > 0 && missingRequiredFields.length === 0;

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Mapping template</p>
          <h4 className="mt-1 text-base font-bold text-slate-900">
            {activeTemplateId ? 'Saved mapping ready' : 'Save this mapping'}
          </h4>
        </div>
        {suggestedTemplate && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            Header match
          </span>
        )}
      </div>

      {suggestedTemplate && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isUsingSuggestedTemplate ? 'Using' : 'Found'} "{suggestedTemplate.name}" / Updated{' '}
              {formatDate(suggestedTemplate.updatedAt)}
            </span>
            <div className="flex shrink-0 gap-2">
              {!isUsingSuggestedTemplate && (
                <button
                  type="button"
                  onClick={() => onUseTemplate(suggestedTemplate)}
                  className="rounded border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                >
                  Use
                </button>
              )}
              <button
                type="button"
                onClick={() => onIgnoreTemplate(suggestedTemplate)}
                className="rounded border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
              >
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      {templateNotice && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {templateNotice}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0">
          <span className="text-sm font-medium text-slate-700">Template name</span>
          <input
            type="text"
            value={templateName}
            onChange={(event) => onTemplateNameChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={!canSaveTemplate}
          onClick={onSaveTemplate}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {activeTemplateId ? 'Update template' : 'Save template'}
        </button>
      </div>

      {missingRequiredFields.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Complete required mappings before saving a template.
        </p>
      )}
    </section>
  );
}

type MappingSuggestionPanelProps = {
  suggestions: MappingSuggestion[];
  suggestionNotice: string | null;
  onApplySuggestions: () => void;
};

function MappingSuggestionPanel({
  suggestions,
  suggestionNotice,
  onApplySuggestions,
}: MappingSuggestionPanelProps) {
  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Mapping suggestions</p>
          <h4 className="mt-1 text-base font-bold text-slate-900">
            Header and sample-value matches
          </h4>
        </div>
        <button
          type="button"
          disabled={suggestions.length === 0}
          onClick={onApplySuggestions}
          className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Apply suggestions
        </button>
      </div>

      {suggestionNotice && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {suggestionNotice}
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600">
          No confident suggestions found.
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {suggestions.map((suggestion) => (
            <div
              key={`${suggestion.field.key}-${suggestion.sourceHeader}`}
              className="grid gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {suggestion.field.label}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{suggestion.field.key}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700">{suggestion.sourceHeader}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{suggestion.reason}</p>
              </div>
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getSuggestionConfidenceClass(
                  suggestion.confidence,
                )}`}
              >
                {formatSuggestionConfidence(suggestion.confidence)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type ColumnMappingEditorProps = {
  mapping: ColumnMapping;
  missingRequiredFields: ImportFieldDefinition[];
  mode: ImportMode;
  preview: CsvPreview;
  onMappingChange: (mapping: ColumnMapping) => void;
};

function ColumnMappingEditor({
  mapping,
  missingRequiredFields,
  mode,
  preview,
  onMappingChange,
}: ColumnMappingEditorProps) {
  const fields = getImportFieldDefinitions(mode);
  const missingFieldKeys = new Set(missingRequiredFields.map((field) => field.key));

  function updateMapping(fieldKey: string, sourceHeader: string) {
    const nextMapping = { ...mapping };

    if (sourceHeader) {
      nextMapping[fieldKey] = sourceHeader;
    } else {
      delete nextMapping[fieldKey];
    }

    onMappingChange(nextMapping);
  }

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Column mapping</p>
          <h4 className="mt-1 text-base font-bold text-slate-900">
            Map CSV columns to TillTally fields
          </h4>
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-500">{fields.length} fields</span>
      </div>

      {missingRequiredFields.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Required mappings missing: {missingRequiredFields.map((field) => field.label).join(', ')}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {fields.map((field) => {
          const isMissing = missingFieldKeys.has(field.key);

          return (
            <div
              key={field.key}
              className={`grid gap-2 rounded-md border bg-white p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center ${
                isMissing ? 'border-amber-200' : 'border-slate-200'
              }`}
            >
              <label htmlFor={`mapping-${field.key}`} className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {field.label}
                </span>
                <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>{field.key}</span>
                  {field.required && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Required
                    </span>
                  )}
                </span>
              </label>

              <select
                id={`mapping-${field.key}`}
                value={mapping[field.key] ?? ''}
                onChange={(event) => updateMapping(field.key, event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="">Not mapped</option>
                {preview.headers.map((header, index) => (
                  <option key={`${header}-${index}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type MappedPreviewTableProps = {
  mapping: ColumnMapping;
  mode: ImportMode;
  preview: CsvPreview;
};

function MappedPreviewTable({ mapping, mode, preview }: MappedPreviewTableProps) {
  const mappedFields = getImportFieldDefinitions(mode).filter((field) => mapping[field.key]);

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-slate-500">Mapped preview</p>
        <span className="text-xs text-slate-500">{preview.previewRows.length} preview rows</span>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200">
        {mappedFields.length === 0 ? (
          <div className="bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Map at least one field to preview transformed rows.
          </div>
        ) : preview.previewRows.length === 0 ? (
          <div className="bg-slate-50 px-3 py-3 text-sm text-slate-600">No data rows found.</div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="min-w-max divide-y divide-slate-200 text-left text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {mappedFields.map((field) => (
                    <th
                      key={field.key}
                      scope="col"
                      className="max-w-48 px-3 py-2 font-semibold text-slate-600"
                    >
                      <span className="block truncate">{field.key}</span>
                      <span className="mt-0.5 block truncate font-normal text-slate-400">
                        {mapping[field.key]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {preview.previewRows.map((row, rowIndex) => (
                  <tr key={`mapped-preview-row-${rowIndex}`}>
                    {mappedFields.map((field) => {
                      const sourceIndex = preview.headers.indexOf(mapping[field.key] ?? '');

                      return (
                        <td
                          key={`${field.key}-${rowIndex}`}
                          className="max-w-48 px-3 py-2 text-slate-700"
                        >
                          <span className="block truncate">
                            {sourceIndex >= 0 ? row[sourceIndex] || '-' : '-'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

type PreflightValidationPanelProps = {
  isSkipConfirmed: boolean;
  validation: PreflightValidation | null;
  onCancelImport: () => void;
  onSkipInvalidRows: () => void;
};

function PreflightValidationPanel({
  isSkipConfirmed,
  validation,
  onCancelImport,
  onSkipInvalidRows,
}: PreflightValidationPanelProps) {
  if (!validation) {
    return null;
  }

  const visibleIssues = validation.issues.slice(0, 50);
  const hiddenIssueCount = validation.issues.length - visibleIssues.length;
  const hasFailedRows = validation.failedRows > 0;
  const hasWarnings = validation.warningRows > 0;

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Row review</p>
          <h4 className="mt-1 text-base font-bold text-slate-900">
            Validate mapped rows before import
          </h4>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
          {validation.rowsTotal} rows checked
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <ImportMetric label="Valid" value={validation.validRows} />
        <ImportMetric label="Warnings" value={validation.warningRows} />
        <ImportMetric label="Failed" value={validation.failedRows} />
      </dl>

      {!hasFailedRows && !hasWarnings && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          All mapped rows passed preflight validation.
        </div>
      )}

      {!hasFailedRows && hasWarnings && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Warning rows can still be imported. Server-side import history will keep final warning
          details.
        </div>
      )}

      {hasFailedRows && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            isSkipConfirmed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {isSkipConfirmed
            ? `${validation.failedRows} failed rows approved to be skipped during import.`
            : `${validation.failedRows} failed rows need a decision before import.`}
        </div>
      )}

      {visibleIssues.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th scope="col" className="w-20 px-3 py-2 font-semibold text-slate-600">
                    Row
                  </th>
                  <th scope="col" className="w-24 px-3 py-2 font-semibold text-slate-600">
                    Status
                  </th>
                  <th scope="col" className="w-36 px-3 py-2 font-semibold text-slate-600">
                    Field
                  </th>
                  <th scope="col" className="min-w-64 px-3 py-2 font-semibold text-slate-600">
                    Issue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleIssues.map((issue, index) => (
                  <tr key={`${issue.row}-${issue.column ?? 'row'}-${issue.severity}-${index}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{issue.row}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${getPreflightIssueClass(
                          issue.severity,
                        )}`}
                      >
                        {issue.severity === 'error' ? 'Failed' : 'Warning'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{issue.column ?? 'row'}</td>
                    <td className="px-3 py-2 text-slate-700">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hiddenIssueCount > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Showing first 50 issues. {hiddenIssueCount} more will be preserved in import history.
            </div>
          )}
        </div>
      )}

      {hasFailedRows && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isSkipConfirmed}
            onClick={onSkipInvalidRows}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Skip invalid rows
          </button>
          <button
            type="button"
            onClick={onCancelImport}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel import
          </button>
          {validation.importableRows === 0 && (
            <p className="text-sm text-slate-500 sm:self-center">
              No valid rows will be written if you continue.
            </p>
          )}
        </div>
      )}
    </section>
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
        <StatePanel
          tone="loading"
          className="mt-5"
          minHeight="sm"
          message="Loading import report..."
        />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-500">Import result</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">No import selected</h3>
        <StatePanel
          className="mt-5"
          minHeight="sm"
          message="Results and row-level issues will appear here."
        />
      </section>
    );
  }

  const issueCount = data.errors.length + data.warnings.length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Import result</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            {formatImportType(data.importType)}
          </h3>
          {data.fileName && <p className="mt-1 text-sm text-slate-600">{data.fileName}</p>}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(data.status)}`}
        >
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
          <InlineNotice tone="success" className="mt-3">
            No row issues found.
          </InlineNotice>
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
        <StatePanel tone="loading" className="mt-4" minHeight="sm" message="Loading history..." />
      )}

      {error && (
        <InlineNotice tone="error" className="mt-4">
          {error}
        </InlineNotice>
      )}

      {!isLoading && !error && jobs.length === 0 && (
        <StatePanel className="mt-4" minHeight="sm" message="No imports yet." />
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

function getDefaultTemplateName(mode: ImportMode, fileName: string): string {
  const fileBaseName = fileName.replace(/\.[^.]+$/, '').trim();

  if (!fileBaseName) {
    return `${formatImportType(mode)} mapping`;
  }

  return `${formatImportType(mode)} mapping - ${fileBaseName}`;
}

function formatDetectedImportType(value: CsvPreviewDetectedType): string {
  if (value === 'UNKNOWN') {
    return 'Unknown';
  }

  return formatImportType(value);
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

function getPreflightIssueClass(severity: ImportIssueSeverity): string {
  if (severity === 'error') {
    return 'bg-red-100 text-red-700';
  }

  return 'bg-amber-100 text-amber-700';
}

function getConfidenceClass(confidence: CsvPreview['confidence']): string {
  if (confidence === 'high') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (confidence === 'medium') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function formatSuggestionConfidence(confidence: MappingSuggestion['confidence']): string {
  const labels: Record<MappingSuggestion['confidence'], string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return labels[confidence];
}

function getSuggestionConfidenceClass(confidence: MappingSuggestion['confidence']): string {
  if (confidence === 'high') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (confidence === 'medium') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function getPreviewNotice(
  detectedType: CsvPreviewDetectedType,
  mode: ImportMode,
): { message: string; tone: 'neutral' | 'warning' } | null {
  if (detectedType === 'UNKNOWN') {
    return {
      message: `No confident import type match. This will import as ${formatImportType(mode)}.`,
      tone: 'neutral',
    };
  }

  if (detectedType === 'INVENTORY') {
    return {
      message: 'Inventory CSV detected. Inventory uploads are not available yet.',
      tone: 'warning',
    };
  }

  if (detectedType !== mode) {
    return {
      message: `Detected ${formatImportType(detectedType)}. This will import as ${formatImportType(
        mode,
      )}.`,
      tone: 'warning',
    };
  }

  return null;
}
