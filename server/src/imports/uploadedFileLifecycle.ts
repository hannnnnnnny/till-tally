import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { type UploadedCsvFile } from './uploadMiddleware';

export async function readUploadedCsvText(uploadedFile: UploadedCsvFile): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of createReadStream(uploadedFile.path, { encoding: 'utf8' })) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

export async function deleteUploadedCsvFile(uploadedFile: UploadedCsvFile): Promise<void> {
  await rm(uploadedFile.path, { force: true });
}
