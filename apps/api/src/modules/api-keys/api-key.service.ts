import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ApiKeyModel, IApiKey } from './api-key.model';
import { logger } from '../../shared/logger';

/**
 * Generate a high-entropy API key.
 * Format: dtk_<prefix>_<secret>
 * The raw key is returned ONLY at creation time.
 * Only the hash is stored.
 */
export function generateApiKey(): { rawKey: string; prefix: string; keyHash: string } {
  const prefix = crypto.randomBytes(4).toString('hex'); // 8 hex chars
  const secret = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const rawKey = `dtk_${prefix}_${secret}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, prefix, keyHash };
}

/**
 * Create a new API key for a source system.
 */
export async function createApiKey(params: {
  tenantId: string;
  sourceSystem: string;
  scopes?: string[];
  expiresAt?: Date;
}): Promise<{ rawKey: string; apiKey: IApiKey }> {
  const { rawKey, prefix, keyHash } = generateApiKey();

  const apiKey = await ApiKeyModel.create({
    tenantId: params.tenantId,
    sourceSystem: params.sourceSystem,
    keyPrefix: prefix,
    keyHash,
    scopes: params.scopes || ['events:write'],
    isActive: true,
    expiresAt: params.expiresAt || null,
  });

  logger.info('API key created', {
    tenantId: params.tenantId,
    sourceSystem: params.sourceSystem,
    prefix,
  });

  return { rawKey, apiKey };
}

/**
 * Revoke an API key by ID.
 */
export async function revokeApiKey(tenantId: string, apiKeyId: string): Promise<boolean> {
  const result = await ApiKeyModel.updateOne(
    { _id: apiKeyId, tenantId },
    { isActive: false }
  );
  if (result.modifiedCount > 0) {
    logger.info('API key revoked', { tenantId, apiKeyId });
    return true;
  }
  return false;
}

/**
 * List API key metadata (never the hash) for a tenant.
 */
export async function listApiKeys(tenantId: string) {
  return ApiKeyModel.find({ tenantId })
    .select('-keyHash')
    .sort({ createdAt: -1 })
    .lean();
}
