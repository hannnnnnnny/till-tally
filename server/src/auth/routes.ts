import { type Response, Router } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { requireAuth } from './middleware';
import { hashPassword, verifyPassword } from './password';
import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from './refreshCookie';
import { asyncHandler } from '../http/asyncHandler';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens';

export const authRouter = Router();

const INVALID_CREDENTIALS_ERROR = 'Invalid email or password';
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;

type SafeUser = {
  id: string;
  name: string;
  email: string;
};

type AuthErrorCode = 'UNAUTHENTICATED' | 'TOKEN_EXPIRED';

function sendAuthSuccess(res: Response, user: SafeUser, statusCode = 200): Response {
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

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

authRouter.post('/register', asyncHandler(async (req, res) => {
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

    return sendAuthSuccess(res, user, 201);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Email is already taken' });
    }

    throw error;
  }
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
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

  return sendAuthSuccess(res, {
    id: user.id,
    name: user.name,
    email: user.email,
  });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
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
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
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
}));

authRouter.post('/logout', (_req, res) => {
  clearRefreshTokenCookie(res);
  return res.status(204).send();
});
