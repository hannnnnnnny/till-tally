import { type CookieOptions, type Request, type Response } from 'express';
import { env } from '../config/env';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.nodeEnv === 'production',
  path: '/api/auth',
};

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...refreshTokenCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);
}

export function getRefreshTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = cookie.split('=');

    if (rawName?.trim() !== REFRESH_TOKEN_COOKIE_NAME) {
      continue;
    }

    const rawValue = rawValueParts.join('=').trim();

    return rawValue ? decodeURIComponent(rawValue) : null;
  }

  return null;
}
