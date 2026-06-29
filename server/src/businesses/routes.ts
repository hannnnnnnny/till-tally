import { Role } from '@prisma/client';
import { type Response, Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/prisma';

export const businessesRouter = Router();

type BusinessField = 'name' | 'industry' | 'city';

function sendValidationError(res: Response, field: BusinessField, message: string): Response {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details: [
        {
          field,
          message,
        },
      ],
    },
  });
}

businessesRouter.post('/', requireAuth, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Missing authenticated user',
      },
    });
  }

  const userId = req.userId;

  if (
    typeof req.body.industry !== 'string' &&
    req.body.industry !== undefined &&
    req.body.industry !== null
  ) {
    return sendValidationError(res, 'industry', 'Industry must be a string');
  }

  if (typeof req.body.city !== 'string' && req.body.city !== undefined && req.body.city !== null) {
    return sendValidationError(res, 'city', 'City must be a string');
  }

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const industry = typeof req.body.industry === 'string' ? req.body.industry.trim() || null : null;
  const city = typeof req.body.city === 'string' ? req.body.city.trim() || null : null;

  if (!name || name.length > 160) {
    return sendValidationError(res, 'name', 'Business name must be between 1 and 160 characters');
  }

  if (industry !== null && industry.length > 80) {
    return sendValidationError(res, 'industry', 'Industry must be 80 characters or fewer');
  }

  if (city !== null && city.length > 80) {
    return sendValidationError(res, 'city', 'City must be 80 characters or fewer');
  }

  const business = await prisma.$transaction(async (tx) => {
    const createdBusiness = await tx.business.create({
      data: {
        ownerId: userId,
        name,
        industry,
        city,
      },
      select: {
        id: true,
        name: true,
        industry: true,
        city: true,
        createdAt: true,
      },
    });

    await tx.businessMember.create({
      data: {
        businessId: createdBusiness.id,
        userId,
        role: Role.OWNER,
      },
    });

    return createdBusiness;
  });

  return res.status(201).json({
    ...business,
    role: Role.OWNER,
  });
});
