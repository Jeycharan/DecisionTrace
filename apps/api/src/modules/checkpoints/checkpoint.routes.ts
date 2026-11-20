import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { CheckpointModel } from './checkpoint.model';
import { CaseModel } from '../cases/case.model';
import { NotFoundError } from '../../shared/errors';
import { paginationSchema } from '../../shared/validation/schemas';

const router = Router();

/**
 * GET /api/v1/cases/:caseId/checkpoints
 * List checkpoints for a case. Does not expose signing secrets.
 */
router.get(
  '/:caseId/checkpoints',
  authenticateJwt,
  requireRole('ADMIN', 'AUDITOR'),
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

      const parseResult = paginationSchema.safeParse(req.query);
      const { page, limit } = parseResult.success ? parseResult.data : { page: 1, limit: 20 };

      const [checkpoints, total] = await Promise.all([
        CheckpointModel.find({
          tenantId: req.tenantId,
          caseId,
        })
          .select('-signature') // Never expose signature to clients
          .sort({ sequence: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        CheckpointModel.countDocuments({
          tenantId: req.tenantId,
          caseId: req.params.caseId,
        }),
      ]);

      res.json({
        data: checkpoints,
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
