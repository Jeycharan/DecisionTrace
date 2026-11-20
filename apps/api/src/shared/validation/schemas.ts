import { z } from 'zod';

// --- Event types registry ---
export const EVENT_TYPES = [
  'CASE_CREATED',
  'EVIDENCE_CAPTURED',
  'DECISION_MADE',
  'REVIEW_REQUESTED',
  'DECISION_OVERRIDDEN',
  'APPROVAL_CONFIRMED',
  'CASE_CLOSED',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// --- Case types ---
export const CASE_TYPES = ['LOAN', 'PAYMENT', 'INSURANCE', 'KYC', 'OTHER'] as const;
export type CaseType = (typeof CASE_TYPES)[number];

// --- Case statuses ---
export const CASE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

// --- User roles ---
export const USER_ROLES = ['ADMIN', 'AUDITOR', 'REVIEWER', 'DISPUTE_HANDLER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// --- Retention statuses ---
export const RETENTION_STATUSES = ['ACTIVE', 'REDACTED'] as const;

// --- Event ingestion schema ---
export const eventIngestionSchema = z.object({
  eventId: z.string().min(1).max(128).describe('Caller-provided idempotency ID'),
  schemaVersion: z.number().int().positive().max(100),
  tenantId: z.string().min(1).max(64),
  caseId: z.string().min(1).max(128),
  sourceSystem: z.string().min(1).max(128),
  eventType: z.enum(EVENT_TYPES),
  occurredAt: z.string().datetime({ message: 'occurredAt must be a valid ISO 8601 datetime' }),
  caseType: z.enum(CASE_TYPES),
  subjectRef: z.string().min(1).max(128),
  payload: z.record(z.unknown()).refine(
    (val) => JSON.stringify(val).length <= 65536,
    { message: 'Payload must not exceed 64KB when serialised' }
  ),
});

export type EventIngestionInput = z.infer<typeof eventIngestionSchema>;

// --- Pagination ---
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Case filter ---
export const caseFilterSchema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  caseType: z.enum(CASE_TYPES).optional(),
  search: z.string().max(256).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).merge(paginationSchema);
