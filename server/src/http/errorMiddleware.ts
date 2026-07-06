import { type ErrorRequestHandler, type RequestHandler } from 'express';

const DEFAULT_SERVER_ERROR_MESSAGE = 'Something went wrong';

type ErrorWithStatus = Error & {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = getStatusCode(error);
  const isServerError = statusCode >= 500;

  if (isServerError && process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.status(statusCode).json({
    error: {
      code: isServerError ? 'INTERNAL_SERVER_ERROR' : getPublicErrorCode(error),
      message: isServerError ? DEFAULT_SERVER_ERROR_MESSAGE : getPublicErrorMessage(error),
    },
  });
};

function getStatusCode(error: unknown): number {
  if (isErrorWithStatus(error)) {
    const status = Number(error.statusCode ?? error.status);

    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      return status;
    }
  }

  return 500;
}

function getPublicErrorCode(error: unknown): string {
  if (isErrorWithStatus(error) && typeof error.code === 'string') {
    return error.code;
  }

  return 'REQUEST_ERROR';
}

function getPublicErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Request failed';
}

function isErrorWithStatus(error: unknown): error is ErrorWithStatus {
  return typeof error === 'object' && error !== null;
}
