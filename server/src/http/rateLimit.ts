import rateLimit from 'express-rate-limit';
import { type RequestHandler } from 'express';

export type RateLimitOptions = {
  code: string;
  max: number;
  message: string;
  windowMs: number;
};

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return rateLimit({
    legacyHeaders: false,
    limit: options.max,
    message: {
      error: {
        code: options.code,
        message: options.message,
      },
    },
    standardHeaders: 'draft-8',
    validate: false,
    windowMs: options.windowMs,
  });
}

export const authRateLimit = createRateLimiter({
  code: 'AUTH_RATE_LIMITED',
  max: 20,
  message: 'Too many authentication attempts. Please try again later.',
  windowMs: FIFTEEN_MINUTES_MS,
});

export const importRateLimit = createRateLimiter({
  code: 'IMPORT_RATE_LIMITED',
  max: 12,
  message: 'Too many import requests. Please try again later.',
  windowMs: FIFTEEN_MINUTES_MS,
});

export const reportRateLimit = createRateLimiter({
  code: 'REPORT_RATE_LIMITED',
  max: 60,
  message: 'Too many report requests. Please try again later.',
  windowMs: FIVE_MINUTES_MS,
});

export const analyticsPlanRateLimit = createRateLimiter({
  code: 'ANALYTICS_PLAN_RATE_LIMITED',
  max: 30,
  message: 'Too many analytics planning requests. Please try again later.',
  windowMs: FIVE_MINUTES_MS,
});

export const analyticsExecutionRateLimit = createRateLimiter({
  code: 'ANALYTICS_EXECUTION_RATE_LIMITED',
  max: 60,
  message: 'Too many analytics execution requests. Please try again later.',
  windowMs: FIVE_MINUTES_MS,
});
