import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  tenantId: string;
  sourceSystem: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    tenantId: { type: String, required: true },
    sourceSystem: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    keyHash: { type: String, required: true },
    scopes: { type: [String], default: ['events:write'] },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.index({ tenantId: 1, sourceSystem: 1 });
apiKeySchema.index({ keyPrefix: 1 });

export const ApiKeyModel = mongoose.model<IApiKey>('ApiKey', apiKeySchema);
