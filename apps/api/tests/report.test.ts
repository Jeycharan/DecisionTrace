import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { UserModel } from '../src/modules/auth/user.model';
import { createApiKey } from '../src/modules/api-keys/api-key.service';
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

describe('Audit Report Generation API', () => {
  let apiKeyRaw: string;
  let authToken: string;

  beforeEach(async () => {
    const { rawKey } = await createApiKey({
      tenantId: 'demo-bank',
      sourceSystem: 'test-system',
    });
    apiKeyRaw = rawKey;

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

    // Create sample case and events
    await supertest(app)
      .post('/api/v1/events')
      .set('X-API-Key', apiKeyRaw)
      .send({
        eventId: 'evt_report_001',
        schemaVersion: 1,
        tenantId: 'demo-bank',
        caseId: 'loan_case_report_01',
        sourceSystem: 'test-system',
        eventType: 'CASE_CREATED',
        occurredAt: '2026-11-20T10:00:00.000Z',
        caseType: 'LOAN',
        subjectRef: 'subj_report_01',
        payload: { test: 'data' },
      });
  });

  it('GET /api/v1/cases/:caseId/report returns formatted HTML audit certificate', async () => {
    const res = await supertest(app)
      .get('/api/v1/cases/loan_case_report_01/report')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('DecisionTrace');
    expect(res.text).toContain('loan_case_report_01');
    expect(res.text).toContain('Cryptographic Hash Chain');
  });

  it('GET /api/v1/cases/:caseId/report with format=json returns structured report data', async () => {
    const res = await supertest(app)
      .get('/api/v1/cases/loan_case_report_01/report?format=json')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.case.caseId).toBe('loan_case_report_01');
    expect(res.body.data.verification.checkedEvents).toBe(1);
    expect(res.body.data.events).toHaveLength(1);
  });

  it('denies unauthenticated requests to report generation', async () => {
    const res = await supertest(app).get('/api/v1/cases/loan_case_report_01/report');
    expect(res.status).toBe(401);
  });
});
