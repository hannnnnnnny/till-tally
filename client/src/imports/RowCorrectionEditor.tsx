import { useState } from 'react';
import { type FailedRowEditor } from './rowCorrections';

export type RowCorrectionControls = {
  editors: FailedRowEditor[];
  correctedRowCount: number;
  onSaveRow: (rowIndex: number, valuesByHeader: Record<string, string>) => void;
  onUndoAll: () => void;
};

const MAX_EDITABLE_ROWS = 20;

export function RowCorrectionEditor({
  editors,
  correctedRowCount,
  onSaveRow,
  onUndoAll,
}: RowCorrectionControls) {
  const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);
  const visibleEditors = editors.slice(0, MAX_EDITABLE_ROWS);

  if (editors.length === 0 && correctedRowCount === 0) {
    return null;
  }

  return (
    <section aria-labelledby="row-correction-title" className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 id="row-correction-title" className="text-sm font-semibold text-slate-900">
          Fix failed rows
        </h5>
        {correctedRowCount > 0 && (
          <UndoCorrections correctedRowCount={correctedRowCount} onUndoAll={onUndoAll} />
        )}
      </div>
      {editors.length === 0 ? (
        <p className="mt-2 text-sm text-emerald-700">All failed rows have been corrected.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {visibleEditors.map((editor) => (
            <li key={editor.rowIndex}>
              <FailedRowItem
                editor={editor}
                isOpen={openRowIndex === editor.rowIndex}
                onToggle={(open) => setOpenRowIndex(open ? editor.rowIndex : null)}
                onSave={(values) => {
                  onSaveRow(editor.rowIndex, values);
                  setOpenRowIndex(null);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {editors.length > MAX_EDITABLE_ROWS && (
        <p className="mt-2 text-xs text-slate-600">
          Showing the first {MAX_EDITABLE_ROWS} failed rows. Fix the source file for bulk errors, or
          skip the remaining rows.
        </p>
      )}
    </section>
  );
}

function FailedRowItem({
  editor,
  isOpen,
  onToggle,
  onSave,
}: {
  editor: FailedRowEditor;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onSave: (valuesByHeader: Record<string, string>) => void;
}) {
  const issueCount = editor.fields.reduce((sum, field) => sum + field.issues.length, 0);

  return (
    <div className="rounded-md border border-red-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-sm text-slate-800">
          <span className="font-semibold">Row {editor.rowNumber}</span>
          <span className="text-slate-600">
            {' '}
            · {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
          </span>
        </p>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => onToggle(!isOpen)}
          className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {isOpen ? 'Close' : `Fix row ${editor.rowNumber}`}
        </button>
      </div>
      {isOpen && (
        <RowCorrectionForm editor={editor} onCancel={() => onToggle(false)} onSave={onSave} />
      )}
    </div>
  );
}

function RowCorrectionForm({
  editor,
  onCancel,
  onSave,
}: {
  editor: FailedRowEditor;
  onCancel: () => void;
  onSave: (valuesByHeader: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(editor.fields.map((field) => [field.sourceHeader, field.value])),
  );

  return (
    <form
      aria-label={`Correct row ${editor.rowNumber}`}
      className="grid gap-3 border-t border-slate-200 px-3 py-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      {editor.fields.map((field) => {
        const inputId = `row-${editor.rowIndex}-${field.key}`;
        const errorId = `${inputId}-error`;
        const hasIssues = field.issues.length > 0;

        return (
          <div key={field.key}>
            <label htmlFor={inputId} className="text-xs font-semibold text-slate-700">
              {field.label}
            </label>
            <input
              id={inputId}
              value={draft[field.sourceHeader] ?? ''}
              aria-invalid={hasIssues}
              aria-describedby={hasIssues ? errorId : undefined}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.sourceHeader]: event.target.value }))
              }
              className={`mt-1 min-h-10 w-full rounded-md border px-3 text-sm ${
                hasIssues ? 'border-red-400 bg-red-50' : 'border-slate-300'
              }`}
            />
            {hasIssues && (
              <p id={errorId} className="mt-1 text-xs text-red-700">
                {field.issues.join('; ')}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          className="min-h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
        >
          Save correction
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function UndoCorrections({
  correctedRowCount,
  onUndoAll,
}: {
  correctedRowCount: number;
  onUndoAll: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const rowLabel = `${correctedRowCount} corrected ${correctedRowCount === 1 ? 'row' : 'rows'}`;

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="text-sm font-medium text-slate-700 underline underline-offset-2"
      >
        Undo corrections ({correctedRowCount})
      </button>
    );
  }

  return (
    <div role="group" aria-label="Confirm undo" className="flex items-center gap-2 text-sm">
      <span className="text-slate-700">Undo {rowLabel}?</span>
      <button
        type="button"
        autoFocus
        onClick={() => setIsConfirming(false)}
        className="min-h-9 rounded-md border border-slate-300 px-3 font-medium text-slate-700"
      >
        Keep
      </button>
      <button
        type="button"
        onClick={() => {
          onUndoAll();
          setIsConfirming(false);
        }}
        className="min-h-9 rounded-md bg-red-700 px-3 font-medium text-white"
      >
        Undo
      </button>
    </div>
  );
}
