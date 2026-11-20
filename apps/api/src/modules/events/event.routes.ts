import { Router, Request, Response, NextFunction } from 'express';
import { authenticateApiKey } from '../../middleware/auth';
import { eventIngestionSchema } from '../../shared/validation/schemas';
import { ingestEvent } from '../ledger/ledger.service';
import { ValidationError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { AccessLogModel } from '../audit-access/access-log.model';

const router = Router();

/**
 * POST /api/v1/events
 * Ingest a financial decision event from an authenticated source system.
 */
router.post(
  '/',
  authenticateApiKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parseResult = eventIngestionSchema.safeParse(req.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        throw new ValidationError('The event payload is invalid.', details);
      }

      const input = parseResult.data;

      // Ensure event tenantId matches authenticated tenant
      if (input.tenantId !== req.tenantId) {
        throw new ValidationError('Event tenantId does not match authenticated tenant');
      }

      // Ingest the event
      const result = await ingestEvent(input);

      // Log access
      await AccessLogModel.create({
        tenantId: req.tenantId!,
        actorId: req.apiKeyId!,
        actorType: 'API_KEY',
        action: result.idempotentReplay ? 'EVENT_REPLAY' : 'EVENT_INGEST',
        resourceType: 'LEDGER_EVENT',
        resourceId: result.eventId,
        requestId: req.requestId,
        outcome: 'SUCCESS',
        metadata: {
          caseId: result.caseId,
          sequence: result.sequence,
          sourceSystem: req.sourceSystem,
          idempotentReplay: result.idempotentReplay,
        },
      }).catch((err: Error) => {
        // Don't fail the request if access logging fails
        logger.error('Failed to create access log', { error: err.message });
      });

      res.status(result.idempotentReplay ? 200 : 201).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
