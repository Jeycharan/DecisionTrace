import mongoose, { Schema, Document } from 'mongoose';

export interface ISnapshot extends Document {
  tenantId: string;
  snapshotId: string;
  caseId: string;
  sourceEventId: string;
  capturedAt: Date;
  evidence: Record<string, unknown>;
  rulesetId: string;
  rulesetVersion: string;
  modelId: string | null;
  modelVersion: string | null;
  featureSchemaVersion: string | null;
  snapshotHash: string;
  createdAt: Date;
}

const snapshotSchema = new Schema<ISnapshot>(
  {
    tenantId: { type: String, required: true },
    snapshotId: { type: String, required: true },
    caseId: { type: String, required: true },
    sourceEventId: { type: String, required: true },
    capturedAt: { type: Date, required: true },
    evidence: { type: Schema.Types.Mixed, required: true },
    rulesetId: { type: String, required: true },
    rulesetVersion: { type: String, required: true },
    modelId: { type: String, default: null },
    modelVersion: { type: String, default: null },
    featureSchemaVersion: { type: String, default: null },
    snapshotHash: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

snapshotSchema.index({ tenantId: 1, snapshotId: 1 }, { unique: true });
snapshotSchema.index({ tenantId: 1, caseId: 1 });

export const SnapshotModel = mongoose.model<ISnapshot>('Snapshot', snapshotSchema);
