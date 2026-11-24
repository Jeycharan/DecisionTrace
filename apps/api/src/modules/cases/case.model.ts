import mongoose, { Schema, Document } from 'mongoose';

export interface ICase extends Document {
  tenantId: string;
  caseId: string;
  caseType: 'LOAN' | 'PAYMENT' | 'INSURANCE' | 'KYC' | 'OTHER';
  subjectRef: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  initialDecision: string | null;
  finalDecision: string | null;
  isOverridden: boolean;
  sourceSystem: string | null;
  latestDecision: string | null;
  latestRiskScore: number | null;
  eventCount: number;
  firstEventAt: Date;
  lastEventAt: Date;
  latestEventHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const caseSchema = new Schema<ICase>(
  {
    tenantId: { type: String, required: true, index: true },
    caseId: { type: String, required: true },
    caseType: {
      type: String,
      required: true,
      enum: ['LOAN', 'PAYMENT', 'INSURANCE', 'KYC', 'OTHER'],
    },
    subjectRef: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED'],
      default: 'OPEN',
    },
    initialDecision: { type: String, default: null },
    finalDecision: { type: String, default: null },
    isOverridden: { type: Boolean, default: false },
    sourceSystem: { type: String, default: null },
    latestDecision: { type: String, default: null },
    latestRiskScore: { type: Number, default: null },
    eventCount: { type: Number, default: 0 },
    firstEventAt: { type: Date, required: true },
    lastEventAt: { type: Date, required: true },
    latestEventHash: { type: String, default: null },
  },
  { timestamps: true }
);

caseSchema.index({ tenantId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ tenantId: 1, lastEventAt: -1 });
caseSchema.index({ tenantId: 1, status: 1 });

export const CaseModel = mongoose.model<ICase>('Case', caseSchema);
