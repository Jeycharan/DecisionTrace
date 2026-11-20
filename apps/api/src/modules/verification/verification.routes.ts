import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { verifyCase } from '../ledger/verification.service';
import { CaseModel } from '../cases/case.model';
import { NotFoundError } from '../../shared/errors';
import { AccessLogModel } from '../audit-access/access-log.model';
import { logger } from '../../shared/logger';

const router = Router();

/**
 * POST /api/v1/cases/:caseId/verify
 * Verify the integrity of a case's hash chain and checkpoints.
 */
router.post(
  '/:caseId/verify',
  authenticateJwt,
  requireRole('ADMIN', 'AUDITOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caseId = req.params.caseId as string;
      // Verify case exists and belongs to tenant
      const caseDoc = await CaseModel.findOne({
        tenantId: req.tenantId,
        caseId,
      }).lean();

      if (!caseDoc) {
        throw new NotFoundError('Case', caseId);
      }

      const result = await verifyCase(req.tenantId!, caseId);

      // Log the verification action
      await AccessLogModel.create({
        tenantId: req.tenantId!,
        actorId: req.userId!,
        actorType: 'USER',
        action: 'CASE_VERIFY',
        resourceType: 'CASE',
        resourceId: caseId,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          verified: result.verified,
          chainConsistent: result.chainConsistent,
          checkpointStatus: result.checkpointStatus,
          checkedEvents: result.checkedEvents,
        },
      }).catch((err: Error) => {
        logger.error('Failed to create access log', { error: err.message });
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
