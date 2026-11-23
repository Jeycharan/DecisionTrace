import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { LedgerEventModel } from '../events/event.model';
import { CaseModel } from '../cases/case.model';
import { SnapshotModel } from '../events/snapshot.model';
import { CheckpointModel } from '../checkpoints/checkpoint.model';
import {
  computeEventHash,
  computeSnapshotHash,
  signCheckpoint,
  GENESIS_HASH,
  EventHashInput,
} from './hash';
import { EventIngestionInput } from '../../shared/validation/schemas';
import { ConflictError, ValidationError, AppError } from '../../shared/errors';
import { config } from '../../config';
import { logger } from '../../shared/logger';
import crypto from 'crypto';

/** Event types that trigger snapshot creation */
const SNAPSHOT_EVENT_TYPES = ['DECISION_MADE', 'EVIDENCE_CAPTURED', 'DECISION_OVERRIDDEN'];

/** Map event types to case status updates */
function deriveStatusFromEvent(eventType: string, payload: Record<string, unknown>): string | null {
  switch (eventType) {
    case 'CASE_CREATED': return 'OPEN';
    case 'REVIEW_REQUESTED': return 'UNDER_REVIEW';
    case 'APPROVAL_CONFIRMED': return 'APPROVED';
    case 'CASE_CLOSED': return 'CLOSED';
    case 'DECISION_MADE': {
      const decision = payload?.decision as Record<string, unknown> | undefined;
      const outcome = decision?.outcome as string | undefined;
      if (outcome === 'APPROVED') return 'APPROVED';
      if (outcome === 'REJECTED') return 'REJECTED';
      if (outcome === 'MANUAL_REVIEW') return 'UNDER_REVIEW';
      return null;
    }
    case 'DECISION_OVERRIDDEN': {
      const override = payload?.override as Record<string, unknown> | undefined;
      const outcome = override?.newOutcome as string | undefined;
      if (outcome === 'APPROVED') return 'APPROVED';
      if (outcome === 'REJECTED') return 'REJECTED';
      return 'UNDER_REVIEW';
    }
    default: return null;
  }
}

export interface IngestResult {
  accepted: boolean;
  eventId: string;
  caseId: string;
  sequence: number;
  eventHash: string;
  idempotentReplay: boolean;
  snapshotId?: string;
  checkpointCreated?: boolean;
}

/**
 * Ingest a validated event into the ledger.
 * 
 * Uses MongoDB transactions for atomicity where supported.
 * Handles: case upsert, sequence allocation, hash chain, snapshots, checkpoints.
 */
export async function ingestEvent(input: EventIngestionInput): Promise<IngestResult> {
  const recordedAt = new Date();

  // 1. Check idempotency
  const existingEvent = await LedgerEventModel.findOne({
    tenantId: input.tenantId,
    sourceSystem: input.sourceSystem,
    eventId: input.eventId,
  }).lean();

  if (existingEvent) {
    // Same eventId exists — check if payload matches
    const existingPayloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(existingEvent.payload))
      .digest('hex');
    const newPayloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(input.payload))
      .digest('hex');

    if (existingPayloadHash === newPayloadHash) {
      return {
        accepted: true,
        eventId: existingEvent.eventId,
        caseId: existingEvent.caseId,
        sequence: existingEvent.sequence,
        eventHash: existingEvent.eventHash,
        idempotentReplay: true,
      };
    } else {
      throw new ConflictError(
        `Event ID '${input.eventId}' already exists with a different payload. ` +
        `This is a security-relevant conflict.`
      );
    }
  }

  // 2. Execute with transaction when supported (replica set), fallback to non-transactional for standalone MongoDB
  const session = await mongoose.startSession();
  let supportsTx = true;
  try {
    let result: IngestResult | null = null;

    const executeIngest = async (activeSession: mongoose.ClientSession | null): Promise<IngestResult> => {
      const opts = activeSession ? { session: activeSession } : {};

      // 3. Upsert case
      // 4. Allocate next sequence atomically
      // Use findOneAndUpdate for atomic increment to prevent race conditions
      const updatedCase = await CaseModel.findOneAndUpdate(
        { tenantId: input.tenantId, caseId: input.caseId },
        {
          $inc: { eventCount: 1 },
          $setOnInsert: {
            caseType: input.caseType,
            subjectRef: input.subjectRef,
            status: 'OPEN',
            latestDecision: null,
            latestRiskScore: null,
            firstEventAt: recordedAt,
            latestEventHash: null,
          },
          $set: {
            lastEventAt: recordedAt,
          },
        },
        { upsert: true, new: true, ...opts }
      );

      const sequence = updatedCase.eventCount; // eventCount after increment = new sequence

      // 5. Get previous hash
      const previousEvent = await LedgerEventModel.findOne(
        { tenantId: input.tenantId, caseId: input.caseId, sequence: sequence - 1 },
        { eventHash: 1 },
        opts
      ).lean();

      const previousHash = previousEvent ? (previousEvent as any).eventHash : GENESIS_HASH;

      // 6. Create snapshot if needed
      let snapshotId: string | null = null;
      if (SNAPSHOT_EVENT_TYPES.includes(input.eventType)) {
        snapshotId = `snap_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

        const snapshotData: Record<string, unknown> = {
          tenantId: input.tenantId,
          snapshotId,
          caseId: input.caseId,
          sourceEventId: input.eventId,
          capturedAt: recordedAt.toISOString(),
          evidence: input.payload,
          rulesetId: (input.payload?.rules as Record<string, unknown>)?.rulesetId || 'unknown',
          rulesetVersion: (input.payload?.rules as Record<string, unknown>)?.rulesetVersion || 'unknown',
          modelId: (input.payload?.model as Record<string, unknown>)?.modelId || null,
          modelVersion: (input.payload?.model as Record<string, unknown>)?.modelVersion || null,
          featureSchemaVersion: null,
        };

        const snapshotHash = computeSnapshotHash(snapshotData);

        await SnapshotModel.create(
          [{
            ...snapshotData,
            snapshotHash,
          }],
          opts
        );
      }

      // 7. Compute event hash
      const hashInput: EventHashInput = {
        tenantId: input.tenantId,
        caseId: input.caseId,
        sequence,
        eventId: input.eventId,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        recordedAt: recordedAt.toISOString(),
        sourceSystem: input.sourceSystem,
        schemaVersion: input.schemaVersion,
        payload: input.payload,
        snapshotId,
        previousHash,
      };

      const eventHash = computeEventHash(hashInput);

      // 8. Persist ledger event
      await LedgerEventModel.create(
        [{
          tenantId: input.tenantId,
          caseId: input.caseId,
          eventId: input.eventId,
          sequence,
          eventType: input.eventType,
          occurredAt: new Date(input.occurredAt),
          recordedAt,
          sourceSystem: input.sourceSystem,
          schemaVersion: input.schemaVersion,
          payload: input.payload,
          snapshotId,
          previousHash,
          eventHash,
          hashAlgorithm: 'SHA-256',
        }],
        opts
      );

      // 9. Update case projection
      const statusUpdate = deriveStatusFromEvent(input.eventType, input.payload);
      const decision = (input.payload?.decision as Record<string, unknown>) || null;

      const caseUpdate: Record<string, unknown> = {
        lastEventAt: recordedAt,
        latestEventHash: eventHash,
      };

      if (statusUpdate) caseUpdate.status = statusUpdate;
      if (decision?.outcome) caseUpdate.latestDecision = decision.outcome;
      if (decision?.riskScore != null) caseUpdate.latestRiskScore = decision.riskScore;

      await CaseModel.updateOne(
        { tenantId: input.tenantId, caseId: input.caseId },
        { $set: caseUpdate },
        opts
      );

      // 10. Create checkpoint if threshold reached
      let checkpointCreated = false;
      if (sequence % config.checkpoint.intervalEvents === 0) {
        const checkpointId = `ckpt_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
        const keyId = 'prototype-hmac-key-1';
        const createdAtStr = recordedAt.toISOString();

        const checkpointPayload = {
          tenantId: input.tenantId,
          caseId: input.caseId,
          sequence,
          eventHash,
          createdAt: createdAtStr,
          keyId,
        };

        const hmacSecret = config.checkpoint.hmacSecret || 'dev-secret-not-for-production';
        const signature = signCheckpoint(checkpointPayload, hmacSecret);

        await CheckpointModel.create(
          [{
            tenantId: input.tenantId,
            caseId: input.caseId,
            checkpointId,
            sequence,
            eventHash,
            signatureAlgorithm: 'HMAC-SHA-256',
            keyId,
            signature,
          }],
          opts
        );

        checkpointCreated = true;
        logger.info('Checkpoint created', {
          tenantId: input.tenantId,
          caseId: input.caseId,
          sequence,
          checkpointId,
        });
      }

      return {
        accepted: true,
        eventId: input.eventId,
        caseId: input.caseId,
        sequence,
        eventHash,
        idempotentReplay: false,
        snapshotId: snapshotId || undefined,
        checkpointCreated,
      };
    };

    try {
      await session.withTransaction(async () => {
        result = await executeIngest(session);
      });
    } catch (txErr: any) {
      if (
        txErr?.message?.includes('replica set') ||
        txErr?.message?.includes('Transaction numbers are only allowed')
      ) {
        supportsTx = false;
        result = await executeIngest(null);
      } else {
        throw txErr;
      }
    }

    if (!result) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Event ingestion failed to produce a result');
    }

    return result;
  } finally {
    await session.endSession();
  }
}
