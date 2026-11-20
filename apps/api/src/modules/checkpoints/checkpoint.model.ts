import mongoose, { Schema, Document } from 'mongoose';

export interface ICheckpoint extends Document {
  tenantId: string;
  caseId: string;
  checkpointId: string;
  sequence: number;
  eventHash: string;
  createdAt: Date;
  signatureAlgorithm: 'HMAC-SHA-256';
  keyId: string;
  signature: string;
}

const checkpointSchema = new Schema<ICheckpoint>(
  {
    tenantId: { type: String, required: true },
    caseId: { type: String, required: true },
    checkpointId: { type: String, required: true },
    sequence: { type: Number, required: true },
    eventHash: { type: String, required: true },
    signatureAlgorithm: {
      type: String,
      required: true,
      enum: ['HMAC-SHA-256'],
      default: 'HMAC-SHA-256',
    },
    keyId: { type: String, required: true },
    signature: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

checkpointSchema.index({ tenantId: 1, caseId: 1, sequence: 1 }, { unique: true });
checkpointSchema.index({ tenantId: 1, checkpointId: 1 }, { unique: true });

export const CheckpointModel = mongoose.model<ICheckpoint>('Checkpoint', checkpointSchema);
