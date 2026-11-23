import crypto from 'crypto';

/**
 * GENESIS value for the first event in a case's hash chain.
 * Documented constant — do not change after deployment.
 */
export const GENESIS_HASH = 'GENESIS';

/**
 * Create a deterministic canonical JSON representation of event fields.
 * - Stable key ordering (sorted alphabetically at every depth)
 * - Consistent UTF-8 encoding
 * - ISO UTC date strings
 * - No undefined values
 * - Deterministic number handling
 */
export function canonicalise(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Sort keys deterministically
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value).sort()) {
        const v = (value as Record<string, unknown>)[k];
        sorted[k] = v === undefined ? null : v;
      }
      return sorted;
    }
    return value;
  });
}

/**
 * Hash input fields for a ledger event.
 */
export interface EventHashInput {
  tenantId: string;
  caseId: string;
  sequence: number;
  eventId: string;
  eventType: string;
  occurredAt: string;   // ISO string
  recordedAt: string;   // ISO string
  sourceSystem: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  snapshotId: string | null;
  previousHash: string | null;
}

/**
 * Compute SHA-256 hash of event fields using canonical serialisation.
 */
export function computeEventHash(input: EventHashInput): string {
  const canonical = canonicalise(input as unknown as Record<string, unknown>);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 hash of a snapshot for integrity.
 */
export function computeSnapshotHash(input: Record<string, unknown>): string {
  const canonical = canonicalise(input);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Sign a checkpoint using HMAC-SHA-256.
 * 
 * PROTOTYPE MECHANISM: If the same operator controls the database and
 * the HMAC secret, this is not independent protection. Production should
 * use KMS/HSM-backed signing or external checkpoint storage.
 */
export function signCheckpoint(
  payload: {
    tenantId: string;
    caseId: string;
    sequence: number;
    eventHash: string;
    createdAt: string;
    keyId: string;
  },
  secret: string
): string {
  const canonical = canonicalise(payload as unknown as Record<string, unknown>);
  return crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

/**
 * Verify a checkpoint signature.
 */
export function verifyCheckpointSignature(
  payload: {
    tenantId: string;
    caseId: string;
    sequence: number;
    eventHash: string;
    createdAt: string;
    keyId: string;
  },
  signature: string,
  secret: string
): boolean {
  const expected = signCheckpoint(payload, secret);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
