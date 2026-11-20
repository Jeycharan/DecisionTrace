import mongoose, { Schema, Document } from 'mongoose';

export interface ILedgerEvent extends Document {
  tenantId: string;
  caseId: string;
  eventId: string;
  sequence: number;
  eventType: string;
  occurredAt: Date;
  recordedAt: Date;
  sourceSystem: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  snapshotId: string | null;
  previousHash: string | null;
  eventHash: string;
  hashAlgorithm: 'SHA-256';
  createdAt: Date;
}

const ledgerEventSchema = new Schema<ILedgerEvent>(
  {
    tenantId: { type: String, required: true },
    caseId: { type: String, required: true },
    eventId: { type: String, required: true },
    sequence: { type: Number, required: true },
    eventType: {
      type: String,
      required: true,
      enum: [
        'CASE_CREATED',
        'EVIDENCE_CAPTURED',
        'DECISION_MADE',
        'REVIEW_REQUESTED',
        'DECISION_OVERRIDDEN',
        'APPROVAL_CONFIRMED',
        'CASE_CLOSED',
      ],
    },
    occurredAt: { type: Date, required: true },
    recordedAt: { type: Date, required: true },
    sourceSystem: { type: String, required: true },
    schemaVersion: { type: Number, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    snapshotId: { type: String, default: null },
    previousHash: { type: String, default: null },
    eventHash: { type: String, required: true },
    hashAlgorithm: { type: String, required: true, enum: ['SHA-256'], default: 'SHA-256' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ledgerEventSchema.index({ tenantId: 1, caseId: 1, sequence: 1 }, { unique: true });
ledgerEventSchema.index({ tenantId: 1, sourceSystem: 1, eventId: 1 }, { unique: true });
ledgerEventSchema.index({ tenantId: 1, caseId: 1, recordedAt: 1 });

export const LedgerEventModel = mongoose.model<ILedgerEvent>('LedgerEvent', ledgerEventSchema);
