import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt } from '../../middleware/auth';
import { CaseModel } from './case.model';
import { LedgerEventModel } from '../events/event.model';
import { caseFilterSchema, paginationSchema } from '../../shared/validation/schemas';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { AccessLogModel } from '../audit-access/access-log.model';
import { logger } from '../../shared/logger';

const router = Router();

/**
 * GET /api/v1/cases
 * List cases with filtering and pagination.
 */
router.get(
  '/',
  authenticateJwt,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = caseFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        throw new ValidationError('Invalid query parameters', details);
      }

      const { page, limit, status, caseType, search, startDate, endDate } = parseResult.data;

      const filter: Record<string, unknown> = { tenantId: req.tenantId };
      if (status) filter.status = status;
      if (caseType) filter.caseType = caseType;
      if (search) filter.caseId = { $regex: search, $options: 'i' };
      if (startDate || endDate) {
        filter.lastEventAt = {};
        if (startDate) (filter.lastEventAt as Record<string, unknown>).$gte = new Date(startDate);
        if (endDate) (filter.lastEventAt as Record<string, unknown>).$lte = new Date(endDate);
      }

      const [cases, total] = await Promise.all([
        CaseModel.find(filter)
          .sort({ lastEventAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        CaseModel.countDocuments(filter),
      ]);

      res.json({
        data: cases,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/cases/:caseId
 * Get a single case by caseId.
 */
router.get(
  '/:caseId',
  authenticateJwt,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caseId = req.params.caseId as string;
      const caseDoc = await CaseModel.findOne({
        tenantId: req.tenantId,
        caseId,
      }).lean();

      if (!caseDoc) {
        throw new NotFoundError('Case', caseId);
      }

      // Log access
      await AccessLogModel.create({
        tenantId: req.tenantId!,
        actorId: req.userId!,
        actorType: 'USER',
        action: 'CASE_VIEW',
        resourceType: 'CASE',
        resourceId: caseId,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {},
      }).catch((err: Error) => {
        logger.error('Failed to create access log', { error: err.message });
      });

      res.json({ data: caseDoc });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/cases/:caseId/events
 * Get events for a case in sequence order.
 */
router.get(
  '/:caseId/events',
  authenticateJwt,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caseId = req.params.caseId as string;
      const parseResult = paginationSchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new ValidationError('Invalid pagination parameters');
      }

      const { page, limit } = parseResult.data;

      // Verify case exists and belongs to tenant
      const caseDoc = await CaseModel.findOne({
        tenantId: req.tenantId,
        caseId,
      }).lean();

      if (!caseDoc) {
        throw new NotFoundError('Case', caseId);
      }

      const [events, total] = await Promise.all([
        LedgerEventModel.find({
          tenantId: req.tenantId,
          caseId,
        })
          .sort({ sequence: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        LedgerEventModel.countDocuments({
          tenantId: req.tenantId,
          caseId,
        }),
      ]);

      res.json({
        data: events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
