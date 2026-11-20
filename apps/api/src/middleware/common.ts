import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';
import { logger } from '../shared/logger';
import { generateRequestId } from '../shared/utils';

// Extend Express Request to include our custom properties
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      tenantId?: string;
      userId?: string;
      userRole?: string;
      apiKeyId?: string;
      sourceSystem?: string;
    }
  }
}

/**
 * Assign a unique request ID to every request.
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = generateRequestId();
  next();
}

/**
 * Global error handler. Never exposes stack traces or secrets to clients.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      requestId: req.requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
    });
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
        requestId: req.requestId,
      },
    });
    return;
  }

  // Unexpected error — log full details but return generic message
  logger.error('Unexpected error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.requestId,
    },
  });
}

/**
 * Request logging middleware.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
}
