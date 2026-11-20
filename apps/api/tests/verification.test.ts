import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { UserModel } from '../src/modules/auth/user.model';
import { LedgerEventModel } from '../src/modules/events/event.model';
import { createApiKey } from '../src/modules/api-keys/api-key.service';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const app = createApp();

function makeToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      userId: 'test-user-id',
      tenantId: 'demo-bank',
      role: 'AUDITOR',
      email: 'auditor@demo.com',
      ...overrides,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

describe('Verification API', () => {
  let apiKeyRaw: string;
  let authToken: string;

  beforeEach(async () => {
    // Create API key
    const { rawKey } = await createApiKey({
      tenantId: 'demo-bank',
      sourceSystem: 'test-system',
    });
    apiKeyRaw = rawKey;

    // Create auditor user
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    await UserModel.create({
      tenantId: 'demo-bank',
      email: 'auditor@demo.com',
      passwordHash,
      displayName: 'Test Auditor',
      role: 'AUDITOR',
      isActive: true,
    });
    authToken = makeToken();

    // Ingest a chain of events
    const events = [
      {
        eventId: 'evt_verify_001',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'verify_case_001',
        sourceSystem: 'test-system',
        eventType: 'CASE_CREATED' as const,
        occurredAt: '2026-11-20T10:00:00.000Z',
        caseType: 'LOAN' as const,
        subjectRef: 'subj_verify_001',
        payload: { description: 'Case created' },
      },
      {
        eventId: 'evt_verify_002',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'verify_case_001',
        sourceSystem: 'test-system',
        eventType: 'EVIDENCE_CAPTURED' as const,
        occurredAt: '2026-11-20T10:01:00.000Z',
        caseType: 'LOAN' as const,
        subjectRef: 'subj_verify_001',
        payload: { evidence: 'income proof' },
      },
      {
        eventId: 'evt_verify_003',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'verify_case_001',
        sourceSystem: 'test-system',
        eventType: 'DECISION_MADE' as const,
        occurredAt: '2026-11-20T10:02:00.000Z',
        caseType: 'LOAN' as const,
        subjectRef: 'subj_verify_001',
        payload: {
          decision: { outcome: 'MANUAL_REVIEW', riskScore: 82 },
          rules: { rulesetId: 'loan-policy', rulesetVersion: '1.0.0' },
        },
      },
    ];

    for (const event of events) {
      await supertest(app)
        .post('/api/v1/events')
        .set('X-API-Key', apiKeyRaw)
        .send(event);
    }
  });

  it('verifies an intact chain (no checkpoints yet)', async () => {
    const res = await supertest(app)
      .post('/api/v1/cases/verify_case_001/verify')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.chainConsistent).toBe(true);
    expect(res.body.data.checkedEvents).toBe(3);
    // No checkpoints yet, so not fully verified
    expect(res.body.data.checkpointStatus).toBe('NO_CHECKPOINTS');
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.limitations.length).toBeGreaterThan(0);
  });

  it('detects tampered event hash', async () => {
    // Tamper with an event hash directly in DB
    await LedgerEventModel.updateOne(
      { tenantId: 'demo-bank', caseId: 'verify_case_001', sequence: 2 },
      { $set: { eventHash: 'tampered_hash_value_000000000000000000000000000000000000' } }
    );

    const res = await supertest(app)
      .post('/api/v1/cases/verify_case_001/verify')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.chainConsistent).toBe(false);
    expect(res.body.data.failure).toBeDefined();
    expect(res.body.data.failure.sequence).toBe(2);
    expect(res.body.data.failure.reason).toBe('EVENT_HASH_MISMATCH');
  });

  it('detects broken previousHash link', async () => {
    // Tamper with previousHash of event 3
    await LedgerEventModel.updateOne(
      { tenantId: 'demo-bank', caseId: 'verify_case_001', sequence: 3 },
      { $set: { previousHash: 'broken_link_000000000000000000000000000000000000000' } }
    );

    const res = await supertest(app)
      .post('/api/v1/cases/verify_case_001/verify')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.chainConsistent).toBe(false);
    expect(res.body.data.failure.sequence).toBe(3);
    expect(res.body.data.failure.reason).toBe('PREVIOUS_HASH_MISMATCH');
  });

  it('detects modified payload', async () => {
    // Tamper with payload
    await LedgerEventModel.updateOne(
      { tenantId: 'demo-bank', caseId: 'verify_case_001', sequence: 1 },
      { $set: { payload: { description: 'TAMPERED DATA' } } }
    );

    const res = await supertest(app)
      .post('/api/v1/cases/verify_case_001/verify')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.chainConsistent).toBe(false);
    expect(res.body.data.failure.sequence).toBe(1);
    expect(res.body.data.failure.reason).toBe('EVENT_HASH_MISMATCH');
  });

  it('denies REVIEWER role from verifying', async () => {
    const reviewerToken = makeToken({ role: 'REVIEWER' });
    const res = await supertest(app)
      .post('/api/v1/cases/verify_case_001/verify')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(403);
  });

  it('verifies with checkpoint when enough events exist', async () => {
    // Add more events to trigger checkpoint (interval = 5 in test)
    for (let i = 4; i <= 6; i++) {
      await supertest(app)
        .post('/api/v1/events')
        .set('X-API-Key', apiKeyRaw)
        .send({
          eventId: `evt_verify_00${i}`,
          schemaVersion: 1,
          tenantId: 'demo-bank',
          caseId: 'verify_case_001',
          sourceSystem: 'test-system',
          eventType: 'REVIEW_REQUESTED',
          occurredAt: `2026-11-20T10:0${i}:00.000Z`,
          caseType: 'LOAN',
          subjectRef: 'subj_verify_001',
          payload: { step: i },
        });
    }

    const res = await supertest(app)
      .post('/api/v1/cases/verify_case_001/verify')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.chainConsistent).toBe(true);
    expect(res.body.data.checkedEvents).toBe(6);
    // Checkpoint should exist at sequence 5
    expect(res.body.data.checkpointCoverage.latestCheckpointSequence).toBe(5);
  });
});
