import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';

declare module 'express-serve-static-core' {
  interface Request {
    uploadedCsvFile?: UploadedCsvFile;
  }
}

export type UploadedCsvFile = {
  fieldName: string;
  originalName: string;
  fileName: string;
  path: string;
  mimeType: string;
  size: number;
};

export type CsvUploadMiddlewareOptions = {
  uploadDir?: string;
  maxFileSizeBytes?: number;
};

type CsvUploadErrorCode = 'BAD_CSV_FORMAT' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE';

const CSV_UPLOAD_FIELD_NAME = 'file';
const CSV_MIME_TYPE = 'text/csv';
const DEFAULT_MAX_UPLOAD_SIZE_MB = 25;

class CsvUploadError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: CsvUploadErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const uploadCsvFile = createCsvUploadMiddleware();

export function createCsvUploadMiddleware(
  options: CsvUploadMiddlewareOptions = {},
): (req: Request, res: Response, next: NextFunction) => void {
  const uploadDir = path.resolve(options.uploadDir ?? getDefaultUploadDir());
  const maxFileSizeBytes = options.maxFileSizeBytes ?? getDefaultMaxFileSizeBytes();

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        mkdir(uploadDir, { recursive: true })
          .then(() => {
            callback(null, uploadDir);
          })
          .catch((error: unknown) => {
            callback(
              error instanceof Error ? error : new Error('Unable to create upload directory'),
              uploadDir,
            );
          });
      },
      filename: (_req, _file, callback) => {
        callback(null, `${randomUUID()}.csv`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (file.mimetype !== CSV_MIME_TYPE) {
        callback(
          new CsvUploadError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload must be a text/csv file'),
        );
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
    },
  }).single(CSV_UPLOAD_FIELD_NAME);

  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error) {
        sendUploadError(res, normalizeUploadError(error, maxFileSizeBytes));
        return;
      }

      if (!req.file) {
        sendUploadError(res, new CsvUploadError(400, 'BAD_CSV_FORMAT', 'A CSV file is required'));
        return;
      }

      req.uploadedCsvFile = {
        fieldName: req.file.fieldname,
        originalName: sanitizeOriginalFilename(req.file.originalname),
        fileName: req.file.filename,
        path: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
      };

      next();
    });
  };
}

function normalizeUploadError(error: unknown, maxFileSizeBytes: number): CsvUploadError {
  if (error instanceof CsvUploadError) {
    return error;
  }

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new CsvUploadError(
        413,
        'FILE_TOO_LARGE',
        `CSV file must be ${formatBytes(maxFileSizeBytes)} or smaller`,
      );
    }

    return new CsvUploadError(400, 'BAD_CSV_FORMAT', 'Invalid multipart file upload');
  }

  return new CsvUploadError(400, 'BAD_CSV_FORMAT', 'Invalid CSV upload');
}

function sendUploadError(res: Response, error: CsvUploadError): void {
  res.status(error.statusCode).json({
    error: {
      code: error.code,
      message: error.message,
    },
  });
}

function sanitizeOriginalFilename(originalName: string): string {
  const normalizedPath = originalName.replace(/\\/g, '/');
  const basename = path.basename(normalizedPath).trim();

  return basename || 'upload.csv';
}

function getDefaultUploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'imports');
}

function getDefaultMaxFileSizeBytes(): number {
  const configuredMax = Number(process.env.MAX_UPLOAD_SIZE_MB ?? DEFAULT_MAX_UPLOAD_SIZE_MB);
  const maxUploadSizeMb =
    Number.isFinite(configuredMax) && configuredMax > 0
      ? configuredMax
      : DEFAULT_MAX_UPLOAD_SIZE_MB;

  return Math.floor(maxUploadSizeMb * 1024 * 1024);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.floor(bytes / (1024 * 1024))}MB`;
  }

  if (bytes >= 1024) {
    return `${Math.floor(bytes / 1024)}KB`;
  }

  return `${bytes} bytes`;
}
