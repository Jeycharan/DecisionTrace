import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from './user.model';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { createApiKey, revokeApiKey, listApiKeys } from '../api-keys/api-key.service';
import { config } from '../../config';
import { ValidationError, AuthenticationError, NotFoundError } from '../../shared/errors';
import { z } from 'zod';
import { AccessLogModel } from '../audit-access/access-log.model';
import { logger } from '../../shared/logger';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createApiKeySchema = z.object({
  sourceSystem: z.string().min(1).max(128),
  scopes: z.array(z.string()).optional(),
  expiresInDays: z.number().int().positive().optional(),
});

/**
 * POST /api/v1/auth/login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid login credentials format');
    }

    const { email, password } = parseResult.data;

    const user = await UserModel.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
      },
      config.jwt.secret || 'dev-jwt-secret',
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    // Log access
    await AccessLogModel.create({
      tenantId: user.tenantId,
      actorId: user._id.toString(),
      actorType: 'USER',
      action: 'LOGIN',
      resourceType: 'AUTH',
      resourceId: user._id.toString(),
      requestId: req.requestId,
      outcome: 'SUCCESS',
      metadata: { email: user.email },
    }).catch((err: Error) => {
      logger.error('Failed to create access log', { error: err.message });
    });

    res.json({
      data: {
        token,
        user: {
          id: user._id,
          tenantId: user.tenantId,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', authenticateJwt, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findById(req.userId).lean();
    if (!user) {
      throw new NotFoundError('User');
    }

    res.json({
      data: {
        id: user._id,
        tenantId: user.tenantId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/api-keys
 * Create a new API key (Admin only). Raw key shown only once.
 */
router.post(
  '/api-keys',
  authenticateJwt,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createApiKeySchema.safeParse(req.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        throw new ValidationError('Invalid API key creation request', details);
      }

      const { sourceSystem, scopes, expiresInDays } = parseResult.data;
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const { rawKey, apiKey } = await createApiKey({
        tenantId: req.tenantId!,
        sourceSystem,
        scopes,
        expiresAt,
      });

      res.status(201).json({
        data: {
          rawKey, // Shown only once!
          apiKey: {
            id: apiKey._id,
            tenantId: apiKey.tenantId,
            sourceSystem: apiKey.sourceSystem,
            keyPrefix: apiKey.keyPrefix,
            scopes: apiKey.scopes,
            isActive: apiKey.isActive,
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
          },
        },
        warning: 'Save this API key now. It will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/api-keys
 * List API key metadata (Admin only).
 */
router.get(
  '/api-keys',
  authenticateJwt,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keys = await listApiKeys(req.tenantId!);
      res.json({ data: keys });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/auth/api-keys/:keyId
 * Revoke an API key (Admin only).
 */
router.delete(
  '/api-keys/:keyId',
  authenticateJwt,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyId = req.params.keyId as string;
      const revoked = await revokeApiKey(req.tenantId!, keyId);
      if (!revoked) {
        throw new NotFoundError('API key', keyId);
      }
      res.json({ data: { revoked: true } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
