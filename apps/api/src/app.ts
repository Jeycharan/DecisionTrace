import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { requestIdMiddleware, errorHandler, requestLogger } from './middleware/common';

// Routes
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import eventRoutes from './modules/events/event.routes';
import caseRoutes from './modules/cases/case.routes';
import verificationRoutes from './modules/verification/verification.routes';
import checkpointRoutes from './modules/checkpoints/checkpoint.routes';

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — narrow in production
  app.use(
    cors({
      origin: config.isDev
        ? ['http://localhost:5173', 'http://localhost:3000']
        : process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );

  // Body parsing with size limit
  app.use(express.json({ limit: '256kb' }));

  // Request ID and logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Rate limiting on public endpoints
  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
  });

  // Routes
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', apiLimiter, authRoutes);
  app.use('/api/v1/events', apiLimiter, eventRoutes);
  app.use('/api/v1/cases', caseRoutes);
  app.use('/api/v1/cases', verificationRoutes);
  app.use('/api/v1/cases', checkpointRoutes);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
