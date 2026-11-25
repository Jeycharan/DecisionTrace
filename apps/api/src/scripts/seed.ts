/**
 * Seed script: creates demo tenant, admin user, auditor user, API key and sample data.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { UserModel } from '../modules/auth/user.model';
import { createApiKey } from '../modules/api-keys/api-key.service';

const TENANT_ID = 'demo-bank';

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/decisiontrace';
  console.log(`Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);

  console.log('Seeding demo data...\n');

  // 1. Create admin user
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const admin = await UserModel.findOneAndUpdate(
    { tenantId: TENANT_ID, email: 'admin@demo-bank.com' },
    {
      tenantId: TENANT_ID,
      email: 'admin@demo-bank.com',
      passwordHash,
      role: 'ADMIN',
      name: 'Bank Administrator',
      status: 'ACTIVE',
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Admin user created/updated: ${admin.email} (Role: ${admin.role})`);

  // 2. Create auditor user
  const auditorHash = await bcrypt.hash('Auditor@123', 10);
  const auditor = await UserModel.findOneAndUpdate(
    { tenantId: TENANT_ID, email: 'auditor@demo-bank.com' },
    {
      tenantId: TENANT_ID,
      email: 'auditor@demo-bank.com',
      passwordHash: auditorHash,
      role: 'AUDITOR',
      name: 'External Auditor',
      status: 'ACTIVE',
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Auditor user created/updated: ${auditor.email} (Role: ${auditor.role})`);

  // 3. Create operator user
  const operatorHash = await bcrypt.hash('Operator@123', 10);
  const operator = await UserModel.findOneAndUpdate(
    { tenantId: TENANT_ID, email: 'operator@demo-bank.com' },
    {
      tenantId: TENANT_ID,
      email: 'operator@demo-bank.com',
      passwordHash: operatorHash,
      role: 'OPERATOR',
      name: 'Loan Officer (Operator)',
      status: 'ACTIVE',
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Operator user created/updated: ${operator.email} (Role: ${operator.role})`);

  // 4. Generate Ingestion API Key
  const { rawKey } = await createApiKey({
    tenantId: TENANT_ID,
    sourceSystem: 'demo-loan-engine',
    scopes: ['events:write', 'events:read', 'cases:read'],
  });
  console.log(`\n✓ Ingestion API Key generated:`);
  console.log(`  Name: demo-ingestion-service`);
  console.log(`  Key:  ${rawKey}`);
  console.log(`  (Save this key or pass it to send-sample-events.ts: npx ts-node scripts/send-sample-events.ts ${rawKey})\n`);

  console.log('Seeding completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
