import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { UserModel } from '../src/modules/auth/user.model';
import { createApiKey } from '../src/modules/api-keys/api-key.service';
import { getRuleEngine } from '../src/modules/replay/rules-registry';
import { config } from '../src/config';
import jwt from 'jsonwebtoken';

const app = createApp();

function makeToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      userId: 'test-user-id',
      tenantId: 'demo-bank',
      role: 'AUDITOR',
      email: 'auditor@demo-bank.com',
      ...overrides,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

describe('Deterministic Rules Registry', () => {
  it('evaluates loan-policy@1.0.0 correctly', () => {
    const engine = getRuleEngine('loan-policy', '1.0.0');

    // Case matching demo: income 45000, existing 200000, age 8, requested 500000
    const result = engine({
      application: {
        monthlyIncome: 45000,
        existingLoanAmount: 200000,
        accountAgeMonths: 8,
        requestedAmount: 500000,
      },
    });

    expect(result.outcome).toBe('MANUAL_REVIEW');
    expect(result.riskScore).toBe(82);
    expect(result.reasonCodes).toContain('HIGH_EXISTING_OBLIGATION');
    expect(result.reasonCodes).toContain('SHORT_ACCOUNT_HISTORY');
  });

  it('evaluates loan-policy@1.1.0 with relaxed account age', () => {
    const engine = getRuleEngine('loan-policy', '1.1.0');

    // With age 8, it doesn't trigger SHORT_ACCOUNT_HISTORY in v1.1.0 (threshold is 6)
    const result = engine({
      application: {
        monthlyIncome: 45000,
        existingLoanAmount: 200000,
        accountAgeMonths: 8,
        requestedAmount: 500000,
      },
    });

    expect(result.reasonCodes).not.toContain('SHORT_ACCOUNT_HISTORY');
    expect(result.riskScore).toBeLessThan(80);
  });

  it('throws on unregistered rule version', () => {
    expect(() => getRuleEngine('loan-policy', '99.9.9')).toThrow(
      /Historical rule version 'loan-policy@99.9.9' is not available/
    );
  });
});

describe('Case Decision Replay API', () => {
  let apiKeyRaw: string;
  let authToken: string;

  beforeEach(async () => {
    // 1. Setup API key
    const { rawKey } = await createApiKey({
      tenantId: 'demo-bank',
      sourceSystem: 'test-loan-system',
    });
    apiKeyRaw = rawKey;

    // 2. Setup user
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    await UserModel.create({
      tenantId: 'demo-bank',
      email: 'auditor@demo-bank.com',
      passwordHash,
      displayName: 'Auditor User',
      role: 'AUDITOR',
      isActive: true,
    });
    authToken = makeToken();

    // 3. Ingest loan creation and decision events
    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({
        eventId: 'evt_replay_001',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'loan_case_replay_101',
        sourceSystem: 'test-loan-system',
        eventType: 'CASE_CREATED',
        occurredAt: '2026-11-20T10:00:00.000Z',
        caseType: 'LOAN',
        subjectRef: 'subj_replay_101',
        payload: { requestedAmount: 500000 },
      });

    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({
        eventId: 'evt_replay_002',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'loan_case_replay_101',
        sourceSystem: 'test-loan-system',
        eventType: 'DECISION_MADE',
        occurredAt: '2026-11-20T10:30:00.000Z',
        caseType: 'LOAN',
        subjectRef: 'subj_replay_101',
        payload: {
          application: {
            requestedAmount: 500000,
            monthlyIncome: 45000,
            existingLoanAmount: 200000,
            accountAgeMonths: 8,
          },
          decision: {
            outcome: 'MANUAL_REVIEW',
            riskScore: 82,
            currency: 'INR',
          },
          reasonCodes: ['HIGH_EXISTING_OBLIGATION', 'SHORT_ACCOUNT_HISTORY'],
          rules: {
            rulesetId: 'loan-policy',
            rulesetVersion: '1.0.0',
          },
        },
      });
  });

  it('replays a decision with 100% deterministic reproducibility', async () => {
    const res = await supertest(app)
      .post('/api/v1/cases/loan_case_replay_101/replay')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reproducible).toBe(true);
    expect(res.body.data.versionStatus).toBe('VERSION_AVAILABLE');
    expect(res.body.data.rulesetId).toBe('loan-policy');
    expect(res.body.data.rulesetVersion).toBe('1.0.0');
    expect(res.body.data.differences).toHaveLength(0);
    expect(res.body.data.original.outcome).toBe('MANUAL_REVIEW');
    expect(res.body.data.replayed.outcome).toBe('MANUAL_REVIEW');
    expect(res.body.data.replayed.riskScore).toBe(82);
  });

  it('detects discrepancies if original decision outcome was recorded differently', async () => {
    // Ingest case with diverging recorded outcome
    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({
        eventId: 'evt_replay_003',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'loan_case_divergent',
        sourceSystem: 'test-loan-system',
        eventType: 'DECISION_MADE',
        occurredAt: '2026-11-20T11:00:00.000Z',
        caseType: 'LOAN',
        subjectRef: 'subj_divergent',
        payload: {
          application: {
            requestedAmount: 500000,
            monthlyIncome: 45000,
            existingLoanAmount: 200000,
            accountAgeMonths: 8,
          },
          decision: {
            outcome: 'APPROVED', // Recorded as APPROVED, but rule says MANUAL_REVIEW!
            riskScore: 50,
          },
          reasonCodes: [],
          rules: {
            rulesetId: 'loan-policy',
            rulesetVersion: '1.0.0',
          },
        },
      });

    const res = await supertest(app)
      .post('/api/v1/cases/loan_case_divergent/replay')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reproducible).toBe(false);
    expect(res.body.data.differences.length).toBeGreaterThan(0);
    expect(res.body.data.differences[0]).toContain("original was 'APPROVED'");
  });

  it('explicitly reports VERSION_UNAVAILABLE when historical version is not in registry', async () => {
    // Ingest case referencing non-existent version 3.5.0
    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({
        eventId: 'evt_replay_004',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'loan_case_unknown_version',
        sourceSystem: 'test-loan-system',
        eventType: 'DECISION_MADE',
        occurredAt: '2026-11-20T11:00:00.000Z',
        caseType: 'LOAN',
        subjectRef: 'subj_unknown_v',
        payload: {
          application: { monthlyIncome: 50000 },
          decision: { outcome: 'APPROVED', riskScore: 30 },
          rules: {
            rulesetId: 'loan-policy',
            rulesetVersion: '3.5.0', // Not registered!
          },
        },
      });

    const res = await supertest(app)
      .post('/api/v1/cases/loan_case_unknown_version/replay')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.versionStatus).toBe('VERSION_UNAVAILABLE');
    expect(res.body.data.reproducible).toBe(false);
    expect(res.body.data.replayed).toBeNull();
    expect(res.body.data.differences[0]).toContain('not available in the rule engine registry');
    expect(res.body.data.explanation).toContain('does not silently substitute newer rule versions');
  });

  it('denies unauthenticated replay requests', async () => {
    const res = await supertest(app).post('/api/v1/cases/loan_case_replay_101/replay');
    expect(res.status).toBe(401);
  });
});
