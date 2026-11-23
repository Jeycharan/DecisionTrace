import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { generateAuditReportData, renderAuditReportHtml } from './report.service';
import { AccessLogModel } from '../audit-access/access-log.model';
import { logger } from '../../shared/logger';

const router = Router();

/**
 * GET /api/v1/cases/:caseId/report
 * Returns a certified audit report in HTML (for printable PDF) or JSON format.
 */
router.get(
  '/:caseId/report',
  authenticateJwt,
  requireRole('ADMIN', 'AUDITOR', 'REVIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caseId = req.params.caseId as string;
      const data = await generateAuditReportData(req.tenantId!, caseId);

      // Audit log
      await AccessLogModel.create({
        tenantId: req.tenantId!,
        actorId: req.userId!,
        actorType: 'USER',
        action: 'CASE_EXPORT_REPORT',
        resourceType: 'CASE',
        resourceId: caseId,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          verified: data.verification.verified,
          checkedEvents: data.verification.checkedEvents,
        },
      }).catch((err: Error) => {
        logger.error('Failed to log report access', { error: err.message });
      });

      if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
        res.json({ data });
        return;
      }

      const html = renderAuditReportHtml(data);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
