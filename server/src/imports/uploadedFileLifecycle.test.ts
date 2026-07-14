import assert from 'node:assert/strict';
import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { deleteUploadedCsvFile, readUploadedCsvText } from './uploadedFileLifecycle';
import { type UploadedCsvFile } from './uploadMiddleware';

describe('uploaded CSV file lifecycle', () => {
  it('reads uploaded CSV text from disk and deletes the temporary file', async () => {
    const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'tilltally-upload-'));
    const filePath = path.join(uploadDir, 'orders.csv');
    const csvText = 'order_number,order_date\n1001,2026-06-20\n';
    await writeFile(filePath, csvText, 'utf8');

    const uploadedFile = createUploadedCsvFile(filePath, csvText.length);

    assert.equal(await readUploadedCsvText(uploadedFile), csvText);
    await deleteUploadedCsvFile(uploadedFile);
    await assert.rejects(() => stat(filePath));
  });

  it('deleting an already removed upload is safe', async () => {
    const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'tilltally-upload-'));
    const filePath = path.join(uploadDir, 'missing.csv');

    await deleteUploadedCsvFile(createUploadedCsvFile(filePath, 0));
  });
});

function createUploadedCsvFile(filePath: string, size: number): UploadedCsvFile {
  return {
    fieldName: 'file',
    fileName: path.basename(filePath),
    mimeType: 'text/csv',
    originalName: path.basename(filePath),
    path: filePath,
    size,
  };
}
