import { type NextFunction, type Request, type Response } from 'express';
import { type Role } from '@prisma/client';
import { prisma } from '../db/prisma';

declare module 'express-serve-static-core' {
  interface Request {
    businessId?: string;
    businessRole?: Role;
  }
}

const BUSINESS_ID_HEADER = 'x-business-id';

function sendBusinessAccessError(res: Response, message: string): void {
  res.status(403).json({
    error: {
      code: 'NO_BUSINESS_ACCESS',
      message,
    },
  });
}

function getBusinessIdFromRequest(req: Request): string | null {
  const businessIdHeader = req.get(BUSINESS_ID_HEADER);

  if (businessIdHeader?.trim()) {
    return businessIdHeader.trim();
  }

  const queryBusinessId = req.query.businessId;

  if (typeof queryBusinessId === 'string' && queryBusinessId.trim()) {
    return queryBusinessId.trim();
  }

  return null;
}

export async function requireBusinessAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Missing authenticated user',
      },
    });
    return;
  }

  const businessId = getBusinessIdFromRequest(req);

  if (!businessId) {
    sendBusinessAccessError(res, 'Missing business context');
    return;
  }

  const membership = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: req.userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    sendBusinessAccessError(res, 'You do not have access to this business');
    return;
  }

  req.businessId = businessId;
  req.businessRole = membership.role;
  next();
}
