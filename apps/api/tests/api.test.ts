import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { UserModel } from '../src/modules/auth/user.model';
import { ApiKeyModel } from '../src/modules/api-keys/api-key.model';
import { LedgerEventModel } from '../src/modules/events/event.model';
import { CaseModel } from '../src/modules/cases/case.model';
import { createApiKey } from '../src/modules/api-keys/api-key.service';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const app = createApp();

function makeToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      userId: 'test-user-id',
      tenantId: 'demo-bank',
      role: 'ADMIN',
      email: 'admin@demo.com',
      ...overrides,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

const sampleEvent = {
  eventId: 'evt_test_0001',
  schemaVersion: 1,
  tenantId: 'demo-bank',
  caseId: 'loan_case_test_001',
  sourceSystem: 'test-system',
  eventType: 'CASE_CREATED',
  occurredAt: '2026-11-20T10:00:00.000Z',
  caseType: 'LOAN' as const,
  subjectRef: 'subj_test_001',
  payload: {
    description: 'Test case creation',
  },
};

describe('Health Endpoint', () => {
  it('GET /api/v1/health returns ok', async () => {
    const res = await supertest(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('decisiontrace-api');
  });
});

describe('Event Ingestion API', () => {
  let apiKeyRaw: string;

  beforeEach(async () => {
    const { rawKey } = await createApiKey({
      tenantId: 'demo-bank',
      sourceSystem: 'test-system',
    });
    apiKeyRaw = rawKey;
  });

  it('accepts a valid event and returns 201', async () => {
    const res = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(sampleEvent);

    expect(res.status).toBe(201);
    expect(res.body.data.accepted).toBe(true);
    expect(res.body.data.eventId).toBe('evt_test_0001');
    expect(res.body.data.caseId).toBe('loan_case_test_001');
    expect(res.body.data.sequence).toBe(1);
    expect(res.body.data.eventHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.data.idempotentReplay).toBe(false);
  });

  it('rejects an event with missing fields', async () => {
    const { eventId, ...invalidEvent } = sampleEvent;
    const res = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(invalidEvent);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles duplicate event idempotently', async () => {
    // First submission
    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(sampleEvent);

    // Second submission with identical payload
    const res = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(sampleEvent);

    expect(res.status).toBe(200);
    expect(res.body.data.idempotentReplay).toBe(true);
  });

  it('returns conflict for same eventId with different payload', async () => {
    // First submission
    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(sampleEvent);

    // Second submission with changed payload
    const res = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({ ...sampleEvent, payload: { description: 'Changed!' } });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('assigns increasing sequence numbers for multiple events', async () => {
    const res1 = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(sampleEvent);

    const res2 = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({
        ...sampleEvent,
        eventId: 'evt_test_0002',
        eventType: 'EVIDENCE_CAPTURED',
        payload: { data: 'evidence' },
      });

    expect(res1.body.data.sequence).toBe(1);
    expect(res2.body.data.sequence).toBe(2);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await supertest(app)
      .post('/api/v1/events')
      .send(sampleEvent);

    expect(res.status).toBe(401);
  });

  it('rejects revoked API key', async () => {
    // Revoke the key
    const key = await ApiKeyModel.findOne({ tenantId: 'demo-bank' });
    await ApiKeyModel.updateOne({ _id: key!._id }, { isActive: false });

    const res = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(sampleEvent);

    expect(res.status).toBe(401);
  });

  it('rejects tenant mismatch', async () => {
    const res = await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({ ...sampleEvent, tenantId: 'other-bank' });

    expect(res.status).toBe(400);
  });
});

describe('Case Query API', () => {
  let apiKeyRaw: string;
  let authToken: string;

  beforeEach(async () => {
    // Create API key
    const { rawKey } = await createApiKey({
      tenantId: 'demo-bank',
      sourceSystem: 'test-system',
    });
    apiKeyRaw = rawKey;

    // Create user and get token
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    await UserModel.create({
      tenantId: 'demo-bank',
      email: 'admin@demo.com',
      passwordHash,
      displayName: 'Test Admin',
      role: 'ADMIN',
      isActive: true,
    });
    authToken = makeToken();

    // Ingest sample events
    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send(sampleEvent);

    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({
        ...sampleEvent,
        eventId: 'evt_test_0002',
        eventType: 'DECISION_MADE',
        payload: {
          decision: { outcome: 'MANUAL_REVIEW', riskScore: 82 },
          rules: { rulesetId: 'loan-policy', rulesetVersion: '1.0.0' },
        },
      });
  });

  it('GET /api/v1/cases returns case list', async () => {
    const res = await supertest(app)
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].caseId).toBe('loan_case_test_001');
    expect(res.body.pagination.total).toBe(1);
  });

  it('GET /api/v1/cases/:caseId returns case detail', async () => {
    const res = await supertest(app)
      .get('/api/v1/cases/loan_case_test_001')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.caseId).toBe('loan_case_test_001');
    expect(res.body.data.eventCount).toBe(2);
  });

  it('GET /api/v1/cases/:caseId/events returns events in sequence order', async () => {
    const res = await supertest(app)
      .get('/api/v1/cases/loan_case_test_001/events')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].sequence).toBe(1);
    expect(res.body.data[1].sequence).toBe(2);
  });

  it('returns 404 for non-existent case', async () => {
    const res = await supertest(app)
      .get('/api/v1/cases/non_existent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it('denies unauthenticated access', async () => {
    const res = await supertest(app).get('/api/v1/cases');
    expect(res.status).toBe(401);
  });

  it('denies cross-tenant access', async () => {
    const otherToken = makeToken({ tenantId: 'other-bank' });
    const res = await supertest(app)
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0); // No cases for other tenant
  });
});

describe('Authentication API', () => {
  beforeEach(async () => {
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    await UserModel.create({
      tenantId: 'demo-bank',
      email: 'admin@demo.com',
      passwordHash,
      displayName: 'Test Admin',
      role: 'ADMIN',
      isActive: true,
    });
  });

  it('POST /api/v1/auth/login succeeds with valid credentials', async () => {
    const res = await supertest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo.com', password: 'TestPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@demo.com');
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('POST /api/v1/auth/login fails with wrong password', async () => {
    const res = await supertest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo.com', password: 'WrongPass!' });

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/me returns current user', async () => {
    const token = makeToken();
    // Need to create user with matching ID
    const user = await UserModel.findOne({ email: 'admin@demo.com' });
    const correctToken = makeToken({ userId: user!._id.toString() });

    const res = await supertest(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${correctToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@demo.com');
  });
});
