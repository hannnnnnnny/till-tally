import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { createCsvUploadMiddleware } from './uploadMiddleware';

type UploadResponse = {
  uploaded: {
    originalName: string;
    fileName: string;
    path: string;
    mimeType: string;
    size: number;
  };
};

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe('CSV upload middleware', () => {
  it('stores text/csv uploads with a generated filename and sanitized original name', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir);

    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('sku,name\nWJ-001,Jacket\n'), {
        filename: '..\\orders.csv',
        contentType: 'text/csv',
      })
      .expect(201);

    const body = response.body as UploadResponse;

    assert.equal(body.uploaded.originalName, 'orders.csv');
    assert.match(body.uploaded.fileName, /^[0-9a-f-]{36}\.csv$/);
    assert.equal(body.uploaded.mimeType, 'text/csv');
    assert.equal(body.uploaded.size, 23);
    assert.ok(body.uploaded.path.startsWith(uploadDir));
    assert.ok(existsSync(body.uploaded.path));
  });

  it('rejects missing file uploads', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir);

    const response = await request(app).post('/upload').expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_CSV_FORMAT');
    assert.equal(body.error.message, 'A CSV file is required');
  });

  it('rejects non text/csv uploads', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir);

    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('{"hello":"world"}'), {
        filename: 'orders.json',
        contentType: 'application/json',
      })
      .expect(415);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.equal(body.error.message, 'Upload must be a text/csv file');
  });

  it('rejects text/csv uploads without a csv filename', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir);

    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('sku,name\nWJ-001,Jacket\n'), {
        filename: 'orders.txt',
        contentType: 'text/csv',
      })
      .expect(415);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.equal(body.error.message, 'Upload must use a .csv filename');
  });

  it('rejects empty CSV uploads and removes the temporary file', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir);

    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.from(''), {
        filename: 'orders.csv',
        contentType: 'text/csv',
      })
      .expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_CSV_FORMAT');
    assert.equal(body.error.message, 'CSV file is empty');
    assert.deepEqual(await readdir(uploadDir), []);
  });

  it('rejects binary CSV uploads and removes the temporary file', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir);

    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.from([0x73, 0x6b, 0x75, 0x00, 0x6e, 0x61, 0x6d, 0x65]), {
        filename: 'orders.csv',
        contentType: 'text/csv',
      })
      .expect(415);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.equal(body.error.message, 'Upload must be a plain-text CSV file');
    assert.deepEqual(await readdir(uploadDir), []);
  });

  it('rejects files over the configured size limit', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir, 10);

    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('12345678901'), {
        filename: 'orders.csv',
        contentType: 'text/csv',
      })
      .expect(413);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'FILE_TOO_LARGE');
    assert.equal(body.error.message, 'CSV file must be 10 bytes or smaller');
  });

  it('rejects uploads that use the wrong multipart field name', async (t) => {
    const uploadDir = await createTempUploadDir(t);
    const app = createTestApp(uploadDir);

    const response = await request(app)
      .post('/upload')
      .attach('csv', Buffer.from('sku,name\nWJ-001,Jacket\n'), {
        filename: 'orders.csv',
        contentType: 'text/csv',
      })
      .expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_CSV_FORMAT');
    assert.equal(body.error.message, 'Invalid multipart file upload');
  });
});

function createTestApp(uploadDir: string, maxFileSizeBytes = 1024): express.Express {
  const app = express();

  app.post(
    '/upload',
    createCsvUploadMiddleware({
      uploadDir,
      maxFileSizeBytes,
    }),
    (req, res) => {
      res.status(201).json({ uploaded: req.uploadedCsvFile });
    },
  );

  return app;
}

async function createTempUploadDir(t: {
  after: (callback: () => void | Promise<void>) => void;
}): Promise<string> {
  const uploadDir = await mkdtemp(path.join(tmpdir(), 'till-tally-upload-'));

  t.after(() => rm(uploadDir, { recursive: true, force: true }));

  return uploadDir;
}
