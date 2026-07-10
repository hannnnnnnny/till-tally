import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

type TokenType = 'access' | 'refresh';

export type AuthTokenPayload = JwtPayload & {
  sub: string;
  type: TokenType;
  jti: string;
};

function signToken(
  userId: string,
  type: TokenType,
  secret: string,
  expiresIn: SignOptions['expiresIn'],
): string {
  if (!userId) {
    throw new Error('User id is required');
  }

  return jwt.sign(
    {
      jti: randomUUID(),
      sub: userId,
      type,
    },
    secret,
    {
      expiresIn,
    },
  );
}

function verifyToken(token: string, type: TokenType, secret: string): AuthTokenPayload {
  const payload = jwt.verify(token, secret);

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string' ||
    payload.type !== type
  ) {
    throw new Error('Invalid token');
  }

  return payload as AuthTokenPayload;
}

export function signAccessToken(userId: string): string {
  return signToken(
    userId,
    'access',
    env.jwtAccessSecret,
    env.jwtAccessExpiresIn as SignOptions['expiresIn'],
  );
}

export function signRefreshToken(userId: string): string {
  return signToken(
    userId,
    'refresh',
    env.jwtRefreshSecret,
    env.jwtRefreshExpiresIn as SignOptions['expiresIn'],
  );
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return verifyToken(token, 'access', env.jwtAccessSecret);
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return verifyToken(token, 'refresh', env.jwtRefreshSecret);
}
