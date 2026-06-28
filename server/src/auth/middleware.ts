import { type NextFunction, type Request, type Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken } from './tokens';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

type AuthErrorCode = 'UNAUTHENTICATED' | 'TOKEN_EXPIRED';

const BEARER_PREFIX = 'Bearer ';

function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();

  return token || null;
}

function sendAuthError(res: Response, code: AuthErrorCode, message: string): void {
  res.status(401).json({
    error: {
      code,
      message,
    },
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req.get('authorization'));

  if (!token) {
    sendAuthError(res, 'UNAUTHENTICATED', 'Missing bearer token');
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      sendAuthError(res, 'TOKEN_EXPIRED', 'Token has expired');
      return;
    }

    sendAuthError(res, 'UNAUTHENTICATED', 'Invalid bearer token');
  }
}
