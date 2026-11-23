export type UserRole = 'ADMIN' | 'AUDITOR' | 'REVIEWER' | 'DISPUTE_HANDLER';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export type CaseType = 'LOAN' | 'PAYMENT' | 'INSURANCE' | 'KYC' | 'OTHER';
export type CaseStatus = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export interface CaseSummary {
  _id: string;
  tenantId: string;
  caseId: string;
  caseType: CaseType;
  subjectRef: string;
  status: CaseStatus;
  latestDecision: string | null;
  latestRiskScore: number | null;
  eventCount: number;
  firstEventAt: string;
  lastEventAt: string;
  latestEventHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEvent {
  _id: string;
  tenantId: string;
  caseId: string;
  eventId: string;
  sequence: number;
  eventType: string;
  occurredAt: string;
  recordedAt: string;
  sourceSystem: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  snapshotId: string | null;
  previousHash: string | null;
  eventHash: string;
  hashAlgorithm: string;
  createdAt: string;
}

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

export interface Checkpoint {
  _id: string;
  tenantId: string;
  caseId: string;
  checkpointId: string;
  sequence: number;
  eventHash: string;
  signatureAlgorithm: string;
  keyId: string;
  createdAt: string;
}

export interface ReplayComparison {
  caseId: string;
  snapshotId: string | null;
  sourceEventId: string;
  rulesetId: string;
  rulesetVersion: string;
  modelVersion: string | null;
  replayedAt: string;
  versionStatus: 'VERSION_AVAILABLE' | 'VERSION_UNAVAILABLE';
  reproducible: boolean;
  original: {
    outcome: string;
    riskScore: number | null;
    reasonCodes: string[];
  };
  replayed: {
    outcome: string;
    riskScore: number | null;
    reasonCodes: string[];
  } | null;
  differences: string[];
  explanation: string;
}

export interface ApiKeyMeta {
  _id: string;
  tenantId: string;
  sourceSystem: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
