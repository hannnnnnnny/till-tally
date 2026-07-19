import { type Request, type RequestHandler, type Response, Router } from 'express';
import { ZodError } from 'zod';
import { asyncHandler } from '../http/asyncHandler';
import {
  SavedReportNotFoundError,
  type SavedReportScope,
  type SavedReportService,
} from './savedReportService';

export type SavedReportsRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  service: SavedReportService;
};

export function createSavedReportsRouter(dependencies: SavedReportsRouterDependencies): Router {
  const router = Router();
  router.use(dependencies.requireAuth, dependencies.requireBusinessAccess);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const scope = requireScope(req, res);
      if (!scope) return;
      res.json({ reports: await dependencies.service.list(scope) });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const scope = requireScope(req, res);
      if (!scope) return;
      try {
        res.status(201).json(await dependencies.service.create(scope, req.body));
      } catch (error) {
        if (sendSavedReportError(error, res)) return;
        throw error;
      }
    }),
  );

  router.get(
    '/:reportId',
    asyncHandler(async (req, res) => {
      const scope = requireScope(req, res);
      if (!scope) return;
      try {
        res.json(await dependencies.service.get(scope, req.params.reportId));
      } catch (error) {
        if (sendSavedReportError(error, res)) return;
        throw error;
      }
    }),
  );

  router.patch(
    '/:reportId',
    asyncHandler(async (req, res) => {
      const scope = requireScope(req, res);
      if (!scope) return;
      try {
        res.json(await dependencies.service.rename(scope, req.params.reportId, req.body));
      } catch (error) {
        if (sendSavedReportError(error, res)) return;
        throw error;
      }
    }),
  );

  router.post(
    '/:reportId/versions',
    asyncHandler(async (req, res) => {
      const scope = requireScope(req, res);
      if (!scope) return;
      try {
        res
          .status(201)
          .json(await dependencies.service.addVersion(scope, req.params.reportId, req.body));
      } catch (error) {
        if (sendSavedReportError(error, res)) return;
        throw error;
      }
    }),
  );

  router.post(
    '/:reportId/duplicate',
    asyncHandler(async (req, res) => {
      const scope = requireScope(req, res);
      if (!scope) return;
      try {
        res
          .status(201)
          .json(await dependencies.service.duplicate(scope, req.params.reportId, req.body));
      } catch (error) {
        if (sendSavedReportError(error, res)) return;
        throw error;
      }
    }),
  );

  router.delete(
    '/:reportId',
    asyncHandler(async (req, res) => {
      const scope = requireScope(req, res);
      if (!scope) return;
      try {
        await dependencies.service.delete(scope, req.params.reportId);
        res.status(204).end();
      } catch (error) {
        if (sendSavedReportError(error, res)) return;
        throw error;
      }
    }),
  );

  return router;
}

function requireScope(req: Request, res: Response): SavedReportScope | null {
  if (req.businessId && req.userId) {
    return { businessId: req.businessId, userId: req.userId };
  }

  res.status(req.userId ? 403 : 401).json({
    error: {
      code: req.userId ? 'NO_BUSINESS_ACCESS' : 'UNAUTHENTICATED',
      message: req.userId ? 'Missing business context' : 'Missing authenticated user',
    },
  });
  return null;
}

function sendSavedReportError(error: unknown, res: Response): boolean {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'INVALID_SAVED_REPORT',
        message: 'The saved report request is invalid.',
        details: error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
      },
    });
    return true;
  }

  if (error instanceof SavedReportNotFoundError) {
    res.status(404).json({
      error: { code: 'SAVED_REPORT_NOT_FOUND', message: error.message },
    });
    return true;
  }

  return false;
}
