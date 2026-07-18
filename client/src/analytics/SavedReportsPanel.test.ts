import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SavedReportDeleteDialog, SavedReportsPanel } from './SavedReportsPanel';
import { type SavedAnalyticsReport } from './types';

describe('SavedReportsPanel', () => {
  it('shows lifecycle actions, version traceability, and compatibility state', () => {
    const markup = renderToStaticMarkup(
      createElement(SavedReportsPanel, {
        open: true,
        reports: [report(), report({ id: 'legacy', compatible: false })],
        status: 'ready',
        error: null,
        activeReportId: 'report-1',
        disabled: false,
        onClose: () => undefined,
        onLoad: () => undefined,
        onRename: () => undefined,
        onDuplicate: () => undefined,
        onDelete: () => undefined,
        onRetry: () => undefined,
      }),
    );

    assert.match(markup, /Saved reports/);
    assert.match(markup, /Version 2/);
    assert.match(markup, /aria-label="Load"/);
    assert.match(markup, /aria-label="Rename"/);
    assert.match(markup, /aria-label="Duplicate"/);
    assert.match(markup, /aria-label="Delete"/);
    assert.match(markup, /Update required/);
  });

  it('renders a useful empty state', () => {
    const markup = renderToStaticMarkup(
      createElement(SavedReportsPanel, {
        open: true,
        reports: [],
        status: 'ready',
        error: null,
        activeReportId: null,
        disabled: false,
        onClose: () => undefined,
        onLoad: () => undefined,
        onRename: () => undefined,
        onDuplicate: () => undefined,
        onDelete: () => undefined,
        onRetry: () => undefined,
      }),
    );

    assert.match(markup, /No saved reports yet/);
  });

  it('describes the destructive scope before deleting a report', () => {
    const markup = renderToStaticMarkup(
      createElement(SavedReportDeleteDialog, {
        report: report(),
        busy: false,
        error: null,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    );

    assert.match(markup, /Delete saved report/);
    assert.match(markup, /Revenue pulse/);
    assert.match(markup, /all 2 saved versions/);
    assert.match(markup, /Keep report/);
    assert.match(markup, /Delete report/);
  });
});

function report(overrides: Partial<SavedAnalyticsReport> = {}): SavedAnalyticsReport {
  return {
    id: 'report-1',
    name: 'Revenue pulse',
    currentVersion: 2,
    compatible: true,
    compatibilityMessage: null,
    latestVersion: null,
    versions: [],
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}
