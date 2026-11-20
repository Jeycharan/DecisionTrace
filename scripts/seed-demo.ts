/**
 * Seed script: creates demo tenant, admin user, API key and sample data.
 * Run: cd apps/api && npx ts-node ../../scripts/seed-demo.ts
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { UserModel } from '../apps/api/src/modules/auth/user.model';
import { createApiKey } from '../apps/api/src/modules/api-keys/api-key.service';

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
      displayName: 'Demo Admin',
      role: 'ADMIN',
      isActive: true,
    },
    { upsert: true, new: true }
  );
  console.log(`Admin user created/updated: admin@demo-bank.com (password: Admin@123)`);

  // 2. Create auditor user
  const auditorHash = await bcrypt.hash('Auditor@123', 10);
  await UserModel.findOneAndUpdate(
    { tenantId: TENANT_ID, email: 'auditor@demo-bank.com' },
    {
      tenantId: TENANT_ID,
      email: 'auditor@demo-bank.com',
      passwordHash: auditorHash,
      displayName: 'Demo Auditor',
      role: 'AUDITOR',
      isActive: true,
    },
    { upsert: true, new: true }
  );
  console.log(`Auditor user created/updated: auditor@demo-bank.com (password: Auditor@123)`);

  // 3. Create API key for demo loan engine
  const { rawKey } = await createApiKey({
    tenantId: TENANT_ID,
    sourceSystem: 'demo-loan-engine',
    scopes: ['events:write'],
  });
  console.log(`\nAPI Key created for 'demo-loan-engine':`);
  console.log(`  Raw Key: ${rawKey}`);
  console.log(`  ⚠ Save this key — it will NOT be shown again!\n`);

  console.log('Seed completed successfully.');
  console.log('\nDemo credentials:');
  console.log('  Admin:   admin@demo-bank.com / Admin@123');
  console.log('  Auditor: auditor@demo-bank.com / Auditor@123');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
