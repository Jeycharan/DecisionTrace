import { LedgerEventModel } from '../events/event.model';
import { CheckpointModel } from '../checkpoints/checkpoint.model';
import { computeEventHash, EventHashInput, verifyCheckpointSignature } from './hash';
import { config } from '../../config';
import { logger } from '../../shared/logger';

export interface VerificationFailure {
  sequence: number;
  eventId: string;
  reason: string;
  details?: string;
}

export interface VerificationResult {
  caseId: string;
  tenantId: string;
  verified: boolean;
  checkedEvents: number;
  chainConsistent: boolean;
  checkpointStatus: 'VALID' | 'MISMATCH' | 'NO_CHECKPOINTS' | 'PARTIAL';
  checkpointCoverage: {
    latestCheckpointSequence: number | null;
    totalEvents: number;
    uncoveredEventCount: number;
  };
  failure: VerificationFailure | null;
  checkpointFailures: VerificationFailure[];
  verifiedAt: string;
  limitations: string[];
}

/**
 * Verify the integrity of a case's hash chain and checkpoints.
 * 
 * Steps:
 * 1. Fetch events in ascending sequence
 * 2. Check sequence continuity
 * 3. Recompute each event hash from stored immutable fields
 * 4. Compare calculated and stored hashes
 * 5. Check previousHash links
 * 6. Verify checkpoint signatures
 * 7. Check checkpoint sequence/hash matches
 * 8. Report first failure
 */
export async function verifyCase(tenantId: string, caseId: string): Promise<VerificationResult> {
  const verifiedAt = new Date().toISOString();

  // Fetch all events in ascending sequence
  const events = await LedgerEventModel.find(
    { tenantId, caseId },
    null,
    { sort: { sequence: 1 } }
  ).lean();

  // Fetch checkpoints
  const checkpoints = await CheckpointModel.find(
    { tenantId, caseId },
    null,
    { sort: { sequence: 1 } }
  ).lean();

  const limitations: string[] = [];

  if (events.length === 0) {
    return {
      caseId,
      tenantId,
      verified: false,
      checkedEvents: 0,
      chainConsistent: false,
      checkpointStatus: 'NO_CHECKPOINTS',
      checkpointCoverage: {
        latestCheckpointSequence: null,
        totalEvents: 0,
        uncoveredEventCount: 0,
      },
      failure: null,
      checkpointFailures: [],
      verifiedAt,
      limitations: ['No events found for this case'],
    };
  }

  let chainConsistent = true;
  let firstFailure: VerificationFailure | null = null;

  // Verify chain
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedSequence = i + 1;

    // Check sequence continuity
    if (event.sequence !== expectedSequence) {
      chainConsistent = false;
      firstFailure = {
        sequence: expectedSequence,
        eventId: event.eventId,
        reason: 'SEQUENCE_GAP',
        details: `Expected sequence ${expectedSequence}, found ${event.sequence}`,
      };
      break;
    }

    // Check previousHash link
    const expectedPreviousHash = i === 0 ? 'GENESIS' : events[i - 1].eventHash;
    if (event.previousHash !== expectedPreviousHash) {
      chainConsistent = false;
      firstFailure = {
        sequence: event.sequence,
        eventId: event.eventId,
        reason: 'PREVIOUS_HASH_MISMATCH',
        details: `Expected previousHash '${expectedPreviousHash.slice(0, 16)}...', found '${(event.previousHash || 'null').slice(0, 16)}...'`,
      };
      break;
    }

    // Recompute event hash
    const hashInput: EventHashInput = {
      tenantId: event.tenantId,
      caseId: event.caseId,
      sequence: event.sequence,
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
      sourceSystem: event.sourceSystem,
      schemaVersion: event.schemaVersion,
      payload: event.payload as Record<string, unknown>,
      snapshotId: event.snapshotId,
      previousHash: event.previousHash,
    };

    const computedHash = computeEventHash(hashInput);

    if (computedHash !== event.eventHash) {
      chainConsistent = false;
      firstFailure = {
        sequence: event.sequence,
        eventId: event.eventId,
        reason: 'EVENT_HASH_MISMATCH',
        details: `Stored hash does not match recomputed hash. Data may have been modified.`,
      };
      break;
    }
  }

  // Verify checkpoints
  const checkpointFailures: VerificationFailure[] = [];
  const hmacSecret = config.checkpoint.hmacSecret || 'dev-secret-not-for-production';

  for (const checkpoint of checkpoints) {
    // Find the event at this checkpoint's sequence
    const matchingEvent = events.find((e) => e.sequence === checkpoint.sequence);

    if (!matchingEvent) {
      checkpointFailures.push({
        sequence: checkpoint.sequence,
        eventId: checkpoint.checkpointId,
        reason: 'EVENT_MISSING_AFTER_CHECKPOINT',
        details: `Checkpoint at sequence ${checkpoint.sequence} references an event that no longer exists`,
      });
      continue;
    }

    // Check event hash matches checkpoint
    if (matchingEvent.eventHash !== checkpoint.eventHash) {
      checkpointFailures.push({
        sequence: checkpoint.sequence,
        eventId: checkpoint.checkpointId,
        reason: 'CHECKPOINT_EVENT_MISMATCH',
        details: `Event hash at sequence ${checkpoint.sequence} differs from checkpoint record`,
      });
      continue;
    }

    // Verify signature
    const checkpointPayload = {
      tenantId: checkpoint.tenantId,
      caseId: checkpoint.caseId,
      sequence: checkpoint.sequence,
      eventHash: checkpoint.eventHash,
      createdAt: checkpoint.createdAt.toISOString(),
      keyId: checkpoint.keyId,
    };

    try {
      const signatureValid = verifyCheckpointSignature(
        checkpointPayload,
        checkpoint.signature,
        hmacSecret
      );

      if (!signatureValid) {
        checkpointFailures.push({
          sequence: checkpoint.sequence,
          eventId: checkpoint.checkpointId,
          reason: 'CHECKPOINT_SIGNATURE_INVALID',
          details: `HMAC signature verification failed for checkpoint at sequence ${checkpoint.sequence}`,
        });
      }
    } catch {
      checkpointFailures.push({
        sequence: checkpoint.sequence,
        eventId: checkpoint.checkpointId,
        reason: 'CHECKPOINT_SIGNATURE_INVALID',
        details: `Could not verify checkpoint signature at sequence ${checkpoint.sequence}`,
      });
    }
  }

  // Determine checkpoint status
  let checkpointStatus: VerificationResult['checkpointStatus'];
  if (checkpoints.length === 0) {
    checkpointStatus = 'NO_CHECKPOINTS';
    limitations.push(
      'No checkpoints exist for this case. Chain consistency is verified but ' +
      'there is no independently signed anchor. Deletion of the newest events ' +
      'cannot be detected without a checkpoint.'
    );
  } else if (checkpointFailures.length === 0) {
    checkpointStatus = 'VALID';
  } else if (checkpointFailures.length < checkpoints.length) {
    checkpointStatus = 'PARTIAL';
  } else {
    checkpointStatus = 'MISMATCH';
  }

  // Checkpoint coverage
  const latestCheckpointSequence = checkpoints.length > 0
    ? Math.max(...checkpoints.map((c) => c.sequence))
    : null;

  const totalEvents = events.length;
  const uncoveredEventCount = latestCheckpointSequence
    ? totalEvents - latestCheckpointSequence
    : totalEvents;

  if (uncoveredEventCount > 0 && latestCheckpointSequence !== null) {
    limitations.push(
      `${uncoveredEventCount} event(s) after the latest checkpoint (sequence ${latestCheckpointSequence}) ` +
      `are not yet covered by a signed checkpoint. Deletion of these events would not be detectable ` +
      `from checkpoints alone.`
    );
  }

  // Final verdict: verified only if chain is consistent AND all checkpoints are valid AND there are checkpoints
  const verified = chainConsistent && checkpointFailures.length === 0 && checkpoints.length > 0;

  if (chainConsistent && checkpoints.length === 0) {
    limitations.push(
      'Chain is internally consistent but has no signed checkpoint anchor. ' +
      'This means the hashes agree with each other, but there is no independent reference point.'
    );
  }

  return {
    caseId,
    tenantId,
    verified,
    checkedEvents: events.length,
    chainConsistent,
    checkpointStatus,
    checkpointCoverage: {
      latestCheckpointSequence,
      totalEvents,
      uncoveredEventCount,
    },
    failure: firstFailure,
    checkpointFailures,
    verifiedAt,
    limitations,
  };
}
