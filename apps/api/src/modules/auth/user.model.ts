import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  tenantId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: 'ADMIN' | 'AUDITOR' | 'REVIEWER' | 'DISPUTE_HANDLER';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    tenantId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['ADMIN', 'AUDITOR', 'REVIEWER', 'DISPUTE_HANDLER'],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// Never return passwordHash in queries by default
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const { passwordHash: _ph, __v: _v, ...rest } = ret as unknown as Record<string, unknown>;
    return rest;
  },
});

export const UserModel = mongoose.model<IUser>('User', userSchema);
