import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { replayDecision } from './replay.service';
import { AccessLogModel } from '../audit-access/access-log.model';
import { logger } from '../../shared/logger';

const router = Router();

/**
 * POST /api/v1/cases/:caseId/replay
 * Replay the deterministic decision for a case from its frozen snapshot and rule version.
 */
router.post(
  '/:caseId/replay',
  authenticateJwt,
  requireRole('ADMIN', 'AUDITOR', 'REVIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caseId = req.params.caseId as string;
      const result = await replayDecision(req.tenantId!, caseId);

      // Audit access log
      await AccessLogModel.create({
        tenantId: req.tenantId!,
        actorId: req.userId!,
        actorType: 'USER',
        action: 'CASE_REPLAY',
        resourceType: 'CASE',
        resourceId: caseId,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          rulesetId: result.rulesetId,
          rulesetVersion: result.rulesetVersion,
          reproducible: result.reproducible,
          versionStatus: result.versionStatus,
        },
      }).catch((err: Error) => {
        logger.error('Failed to create access log for replay', { error: err.message });
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
