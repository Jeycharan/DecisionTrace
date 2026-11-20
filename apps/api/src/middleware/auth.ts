import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { AuthenticationError, AuthorizationError } from '../shared/errors';
import { ApiKeyModel } from '../modules/api-keys/api-key.model';
import { UserRole } from '../shared/validation/schemas';

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

/**
 * Authenticate staff users via JWT Bearer token.
 */
export function authenticateJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Missing or invalid Authorization header'));
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    next(new AuthenticationError('Invalid or expired token'));
  }
}

/**
 * Authenticate external systems via API key.
 * API keys are sent in the X-API-Key header.
 * Format: dtk_<prefix>_<secret>
 */
export async function authenticateApiKey(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return next(new AuthenticationError('Missing X-API-Key header'));
  }

  // Extract prefix (first 8 chars after dtk_)
  const parts = apiKey.split('_');
  if (parts.length < 3 || parts[0] !== 'dtk') {
    return next(new AuthenticationError('Invalid API key format'));
  }

  const prefix = parts[1];

  try {
    // Find by prefix
    const apiKeyDoc = await ApiKeyModel.findOne({ keyPrefix: prefix, isActive: true });
    if (!apiKeyDoc) {
      return next(new AuthenticationError('Invalid or revoked API key'));
    }

    // Check expiry
    if (apiKeyDoc.expiresAt && apiKeyDoc.expiresAt < new Date()) {
      return next(new AuthenticationError('API key has expired'));
    }

    // Verify hash
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    if (keyHash !== apiKeyDoc.keyHash) {
      return next(new AuthenticationError('Invalid API key'));
    }

    // Update last used
    await ApiKeyModel.updateOne({ _id: apiKeyDoc._id }, { lastUsedAt: new Date() });

    req.tenantId = apiKeyDoc.tenantId;
    req.apiKeyId = apiKeyDoc._id.toString();
    req.sourceSystem = apiKeyDoc.sourceSystem;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-based access control middleware factory.
 * Deny by default; allow only specified roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      return next(new AuthenticationError('Authentication required'));
    }
    if (!allowedRoles.includes(req.userRole as UserRole)) {
      return next(new AuthorizationError(`Role '${req.userRole}' does not have permission for this action`));
    }
    next();
  };
}
