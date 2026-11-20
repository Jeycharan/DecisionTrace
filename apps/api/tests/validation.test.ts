import { describe, it, expect } from 'vitest';
import { eventIngestionSchema } from '../src/shared/validation/schemas';

describe('Event Validation Schema', () => {
  const validEvent = {
    eventId: 'evt_demo_0001',
    schemaVersion: 1,
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sourceSystem: 'demo-loan-engine',
    eventType: 'DECISION_MADE',
    occurredAt: '2026-11-20T10:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_demo_1001',
    payload: {
      application: { requestedAmount: 500000 },
      decision: { outcome: 'MANUAL_REVIEW', riskScore: 82 },
    },
  };

  it('accepts a valid event', () => {
    const result = eventIngestionSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('rejects missing eventId', () => {
    const { eventId, ...invalid } = validEvent;
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing tenantId', () => {
    const { tenantId, ...invalid } = validEvent;
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects unsupported event type', () => {
    const invalid = { ...validEvent, eventType: 'INVALID_TYPE' };
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects unsupported case type', () => {
    const invalid = { ...validEvent, caseType: 'INVALID' };
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime format', () => {
    const invalid = { ...validEvent, occurredAt: 'not-a-date' };
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects negative schema version', () => {
    const invalid = { ...validEvent, schemaVersion: -1 };
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty string fields', () => {
    const invalid = { ...validEvent, eventId: '' };
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects overly long eventId', () => {
    const invalid = { ...validEvent, eventId: 'x'.repeat(200) };
    const result = eventIngestionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
