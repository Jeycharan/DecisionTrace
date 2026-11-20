import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessLog extends Document {
  tenantId: string;
  actorId: string;
  actorType: 'USER' | 'API_KEY' | 'SYSTEM';
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
  metadata: Record<string, unknown>;
  timestamp: Date;
}

const accessLogSchema = new Schema<IAccessLog>(
  {
    tenantId: { type: String, required: true },
    actorId: { type: String, required: true },
    actorType: { type: String, required: true, enum: ['USER', 'API_KEY', 'SYSTEM'] },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true },
    requestId: { type: String, required: true },
    outcome: { type: String, required: true, enum: ['SUCCESS', 'DENIED', 'ERROR'] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

accessLogSchema.index({ tenantId: 1, timestamp: -1 });
accessLogSchema.index({ tenantId: 1, actorId: 1 });
accessLogSchema.index({ tenantId: 1, resourceType: 1, resourceId: 1 });

export const AccessLogModel = mongoose.model<IAccessLog>('AccessLog', accessLogSchema);
