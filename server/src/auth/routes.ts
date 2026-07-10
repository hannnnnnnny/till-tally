import { type RequestHandler, type Response, Router } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../http/asyncHandler';
import { authRateLimit } from '../http/rateLimit';
import { requireAuth } from './middleware';
import { hashPassword, verifyPassword } from './password';
import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from './refreshCookie';
import { refreshTokenStore, type RefreshTokenStore } from './refreshTokenStore';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens';

const INVALID_CREDENTIALS_ERROR = 'Invalid email or password';
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;

export type AuthRouterOptions = {
  authRateLimit?: RequestHandler;
  refreshTokenStore?: RefreshTokenStore;
};

type SafeUser = {
  id: string;
  name: string;
  email: string;
};

type AuthErrorCode = 'UNAUTHENTICATED' | 'TOKEN_EXPIRED';

async function sendAuthSuccess(
  res: Response,
  user: SafeUser,
  tokenStore: RefreshTokenStore,
  statusCode = 200,
): Promise<Response> {
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  await tokenStore.storeRefreshToken(user.id, refreshToken, verifyRefreshToken(refreshToken));
  setRefreshTokenCookie(res, refreshToken);

  return res.status(statusCode).json({
    user,
    accessToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  });
}

function sendAuthError(res: Response, code: AuthErrorCode, message: string): Response {
  return res.status(401).json({
    error: {
      code,
      message,
    },
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const router = Router();
  const authLimiter = options.authRateLimit ?? authRateLimit;
  const tokenStore = options.refreshTokenStore ?? refreshTokenStore;

  router.post(
    '/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body.password === 'string' ? req.body.password : '';

      if (!name || name.length > 120) {
        return res.status(400).json({ error: 'Name is required' });
      }

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const passwordHash = await hashPassword(password);

      try {
        const user = await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        return sendAuthSuccess(res, user, tokenStore, 201);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return res.status(409).json({ error: 'Email is already taken' });
        }

        throw error;
      }
    }),
  );

  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body.password === 'string' ? req.body.password : '';

      if (!email || !email.includes('@') || !password) {
        return res.status(400).json({ error: 'Valid email and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
        },
      });

      if (!user) {
        return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
      }

      const isValidPassword = await verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
      }

      return sendAuthSuccess(
        res,
        {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        tokenStore,
      );
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!req.userId) {
        return sendAuthError(res, 'UNAUTHENTICATED', 'Missing authenticated user');
      }

      const user = await prisma.user.findUnique({
        where: {
          id: req.userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        return sendAuthError(res, 'UNAUTHENTICATED', 'Authenticated user not found');
      }

      return res.json({
        user,
      });
    }),
  );

  router.post(
    '/refresh',
    authLimiter,
    asyncHandler(async (req, res) => {
      const refreshToken = getRefreshTokenFromRequest(req);

      if (!refreshToken) {
        return sendAuthError(res, 'UNAUTHENTICATED', 'Missing refresh token');
      }

      try {
        const payload = verifyRefreshToken(refreshToken);
        const user = await prisma.user.findUnique({
          where: {
            id: payload.sub,
          },
          select: {
            id: true,
          },
        });

        if (!user) {
          clearRefreshTokenCookie(res);
          return sendAuthError(res, 'UNAUTHENTICATED', 'Invalid refresh token');
        }

        const accessToken = signAccessToken(user.id);
        const nextRefreshToken = signRefreshToken(user.id);
        const nextRefreshPayload = verifyRefreshToken(nextRefreshToken);
        const rotated = await tokenStore.rotateRefreshToken(
          user.id,
          refreshToken,
          nextRefreshToken,
          nextRefreshPayload,
        );

        if (!rotated) {
          clearRefreshTokenCookie(res);
          return sendAuthError(res, 'UNAUTHENTICATED', 'Invalid refresh token');
        }

        setRefreshTokenCookie(res, nextRefreshToken);

        return res.json({
          accessToken,
          expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        });
      } catch (error) {
        clearRefreshTokenCookie(res);

        if (error instanceof TokenExpiredError) {
          return sendAuthError(res, 'TOKEN_EXPIRED', 'Refresh token has expired');
        }

        return sendAuthError(res, 'UNAUTHENTICATED', 'Invalid refresh token');
      }
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const refreshToken = getRefreshTokenFromRequest(req);

      if (refreshToken) {
        await tokenStore.revokeRefreshToken(refreshToken);
      }

      clearRefreshTokenCookie(res);
      return res.status(204).send();
    }),
  );

  return router;
}

export const authRouter = createAuthRouter();
