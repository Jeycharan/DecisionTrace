/**
 * Tamper Demo Script (Development Only)
 * 
 * Demonstrates DecisionTrace's tamper-evidence by deliberately modifying
 * an event in the database and showing how verifyCase detects it.
 * 
 * Usage:
 *   npx ts-node scripts/tamper-demo.ts --case=loan_case_1001 --tamper-payload --confirm
 *   npx ts-node scripts/tamper-demo.ts --case=loan_case_1001 --tamper-hash --confirm
 *   npx ts-node scripts/tamper-demo.ts --case=loan_case_1001 --restore --confirm
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { LedgerEventModel } from '../apps/api/src/modules/events/event.model';
import { verifyCase } from '../apps/api/src/modules/ledger/verification.service';

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const caseArg = args.find((a) => a.startsWith('--case='));
  const caseId = caseArg ? caseArg.split('=')[1] : 'loan_case_1001';
  const tenantId = 'demo-bank';

  if (!confirm) {
    console.error('⚠ SAFETY CHECK: You must pass --confirm to run the tamper demonstration.');
    console.error('This script modifies test database records for demonstration purposes only.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/decisiontrace';
  await mongoose.connect(uri);

  console.log(`\n=== DecisionTrace Tamper Demonstration ===`);
  console.log(`Case ID: ${caseId} (Tenant: ${tenantId})\n`);

  if (args.includes('--tamper-payload')) {
    console.log('1. Fetching sequence 3 event (DECISION_MADE)...');
    const targetEvent = await LedgerEventModel.findOne({ tenantId, caseId, sequence: 3 });

    if (!targetEvent) {
      console.error('Event sequence 3 not found in case. Ingest events first using send-sample-events.ts');
      process.exit(1);
    }

    console.log('Original Decision Outcome:', (targetEvent.payload as any)?.decision?.outcome);
    console.log('Original Risk Score:', (targetEvent.payload as any)?.decision?.riskScore);

    console.log('\n2. Maliciously tampering with payload directly in MongoDB...');
    console.log('   (Simulating a rogue DB admin changing MANUAL_REVIEW to APPROVED and altering risk score)');

    const tamperedPayload = {
      ...(targetEvent.payload as any),
      decision: {
        outcome: 'APPROVED',
        riskScore: 20, // Tampered score!
        currency: 'INR',
      },
    };

    await LedgerEventModel.updateOne(
      { _id: targetEvent._id },
      { $set: { payload: tamperedPayload } }
    );

    console.log('✓ Payload tampered in database (stored eventHash left unchanged).\n');

    console.log('3. Running verification service...');
    const result = await verifyCase(tenantId, caseId);

    console.log('Verification Outcome:');
    console.log(`  Verified: ${result.verified}`);
    console.log(`  Chain Consistent: ${result.chainConsistent}`);
    console.log(`  Checkpoint Status: ${result.checkpointStatus}`);
    if (result.failure) {
      console.log(`\n  🚨 TAMPER DETECTED!`);
      console.log(`     Sequence: #${result.failure.sequence}`);
      console.log(`     Event ID: ${result.failure.eventId}`);
      console.log(`     Reason:   ${result.failure.reason}`);
      console.log(`     Details:  ${result.failure.details}`);
    }
  } else if (args.includes('--tamper-hash')) {
    console.log('1. Altering eventHash directly in MongoDB...');
    await LedgerEventModel.updateOne(
      { tenantId, caseId, sequence: 2 },
      { $set: { eventHash: '0000000000000000000000000000000000000000000000000000000000000000' } }
    );
    console.log('✓ Hash altered at sequence 2.\n');

    console.log('2. Running verification service...');
    const result = await verifyCase(tenantId, caseId);
    console.log(`  Chain Consistent: ${result.chainConsistent}`);
    console.log(`  Failure:`, result.failure);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Tamper demo failed:', err);
  process.exit(1);
});
