import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma';
import { type AuthTokenPayload } from './tokens';

export type RefreshTokenRecordState = {
  expiresAt: Date;
  revokedAt: Date | null;
};

export type RefreshTokenStore = {
  storeRefreshToken(userId: string, refreshToken: string, payload: AuthTokenPayload): Promise<void>;
  rotateRefreshToken(
    userId: string,
    currentRefreshToken: string,
    nextRefreshToken: string,
    nextPayload: AuthTokenPayload,
  ): Promise<boolean>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
};

export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

export function getRefreshTokenExpiresAt(payload: AuthTokenPayload): Date {
  if (typeof payload.exp !== 'number') {
    throw new Error('Refresh token exp claim is required');
  }

  return new Date(payload.exp * 1000);
}

export function isRefreshTokenRecordUsable(
  record: RefreshTokenRecordState,
  now = new Date(),
): boolean {
  return record.revokedAt === null && record.expiresAt > now;
}

async function storeRefreshToken(
  userId: string,
  refreshToken: string,
  payload: AuthTokenPayload,
): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiresAt(payload),
    },
  });
}

async function rotateRefreshToken(
  userId: string,
  currentRefreshToken: string,
  nextRefreshToken: string,
  nextPayload: AuthTokenPayload,
): Promise<boolean> {
  const currentTokenHash = hashRefreshToken(currentRefreshToken);
  const nextTokenHash = hashRefreshToken(nextRefreshToken);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const currentTokenRecord = await transaction.refreshToken.findUnique({
      where: {
        tokenHash: currentTokenHash,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (
      !currentTokenRecord ||
      currentTokenRecord.userId !== userId ||
      !isRefreshTokenRecordUsable(currentTokenRecord, now)
    ) {
      return false;
    }

    await transaction.refreshToken.update({
      where: {
        id: currentTokenRecord.id,
      },
      data: {
        revokedAt: now,
        replacedByTokenHash: nextTokenHash,
      },
    });

    await transaction.refreshToken.create({
      data: {
        userId,
        tokenHash: nextTokenHash,
        expiresAt: getRefreshTokenExpiresAt(nextPayload),
      },
    });

    return true;
  });
}

async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export const refreshTokenStore: RefreshTokenStore = {
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
};
