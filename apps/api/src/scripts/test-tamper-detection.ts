/**
 * DecisionTrace Tamper Detection Test Script
 * 
 * Tests three tampering scenarios:
 * 1. Edit an event (payload alteration -> EVENT_HASH_MISMATCH)
 * 2. Insert a fake event (chain discontinuity -> PREVIOUS_HASH_MISMATCH / SEQUENCE_GAP)
 * 3. Delete the newest event (anchored by signed checkpoint -> EVENT_MISSING_AFTER_CHECKPOINT)
 * 
 * Each test verifies that the verification engine detects the tampering,
 * and prints an ASCII summary table.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { LedgerEventModel } from '../modules/events/event.model';
import { CaseModel } from '../modules/cases/case.model';
import { CheckpointModel } from '../modules/checkpoints/checkpoint.model';
import { ingestEvent } from '../modules/ledger/ledger.service';
import { verifyCase } from '../modules/ledger/verification.service';

const TENANT_ID = 'demo-bank';
const CASE_ID = 'test_tamper_suite_case';

interface TestResult {
  testNumber: number;
  tamperAction: string;
  injectedTamper: string;
  expectedDetection: string;
  actualDetection: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

async function runTamperTests() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/decisiontrace';
  console.log(`Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);

  console.log('Setting up clean test case fixture: ' + CASE_ID);

  // Clean any previous test data
  await LedgerEventModel.deleteMany({ tenantId: TENANT_ID, caseId: CASE_ID });
  await CaseModel.deleteMany({ tenantId: TENANT_ID, caseId: CASE_ID });
  await CheckpointModel.deleteMany({ tenantId: TENANT_ID, caseId: CASE_ID });

  // Ingest 10 events to generate sequence 1..10 with an HMAC checkpoint at sequence 10
  console.log('Ingesting 10 sequential events (checkpoint generated at seq #10)...');
  for (let seq = 1; seq <= 10; seq++) {
    await ingestEvent({
      eventId: `evt_test_tamper_${seq.toString().padStart(4, '0')}`,
      schemaVersion: 1,
      tenantId: TENANT_ID,
      caseId: CASE_ID,
      sourceSystem: 'tamper-test-suite',
      eventType: seq === 1 ? 'CASE_CREATED' : seq === 3 ? 'DECISION_MADE' : 'EVIDENCE_CAPTURED',
      occurredAt: new Date(Date.now() - (11 - seq) * 60000).toISOString(),
      caseType: 'LOAN',
      subjectRef: 'subj_tamper_test',
      payload: {
        step: seq,
        amount: seq * 10000,
        decision: seq === 3 ? { outcome: 'MANUAL_REVIEW', riskScore: 75 } : undefined,
      },
    });
  }

  // Baseline verification
  const baseline = await verifyCase(TENANT_ID, CASE_ID);
  if (!baseline.verified) {
    console.error('❌ Baseline verification failed! Expected clean 10-event chain to pass.', baseline);
    process.exit(1);
  }
  console.log(`✓ Baseline verified: ${baseline.checkedEvents} events, checkpoint status: ${baseline.checkpointStatus}\n`);

  const results: TestResult[] = [];

  // =========================================================================
  // TEST 1: Edit an event payload (Seq #3)
  // =========================================================================
  console.log('--- Running Test 1: Edit an event ---');
  const originalEvt3 = await LedgerEventModel.findOne({ tenantId: TENANT_ID, caseId: CASE_ID, sequence: 3 }).lean();
  if (!originalEvt3) throw new Error('Original event 3 not found');

  // Modify payload in DB without recomputing hash
  await LedgerEventModel.updateOne(
    { tenantId: TENANT_ID, caseId: CASE_ID, sequence: 3 },
    { $set: { 'payload.amount': 9999999, 'payload.decision.outcome': 'APPROVED_FRAUDULENT' } }
  );

  const res1 = await verifyCase(TENANT_ID, CASE_ID);
  const test1Passed = !res1.chainConsistent && res1.failure?.reason === 'EVENT_HASH_MISMATCH' && res1.failure?.sequence === 3;

  results.push({
    testNumber: 1,
    tamperAction: 'Edit Event (Seq #3)',
    injectedTamper: 'Modified payload amount to 9,999,999 and outcome to APPROVED_FRAUDULENT',
    expectedDetection: 'EVENT_HASH_MISMATCH at Seq #3',
    actualDetection: `${res1.failure?.reason || 'None'} at Seq #${res1.failure?.sequence || 'N/A'}`,
    status: test1Passed ? 'PASS' : 'FAIL',
    details: res1.failure?.details || 'No details',
  });
  console.log(`Result: ${test1Passed ? '✓ PASS' : '✗ FAIL'} (${res1.failure?.reason} at Seq #${res1.failure?.sequence})`);

  // Restore event 3
  await LedgerEventModel.updateOne(
    { tenantId: TENANT_ID, caseId: CASE_ID, sequence: 3 },
    { $set: { payload: originalEvt3.payload } }
  );
  const restoreRes1 = await verifyCase(TENANT_ID, CASE_ID);
  if (!restoreRes1.verified) throw new Error('Failed to restore after Test 1');

  // =========================================================================
  // TEST 2: Insert a fake event (Seq #5 inserted into chain)
  // =========================================================================
  console.log('\n--- Running Test 2: Insert a fake event ---');
  // Shift events 5..10 to 6..11 in descending order to avoid unique index conflict
  for (let s = 10; s >= 5; s--) {
    await LedgerEventModel.updateOne(
      { tenantId: TENANT_ID, caseId: CASE_ID, sequence: s },
      { $set: { sequence: s + 1 } }
    );
  }

  // Inject a rogue fake event at sequence 5
  const fakeEvent = await LedgerEventModel.create({
    tenantId: TENANT_ID,
    caseId: CASE_ID,
    eventId: 'evt_fake_injected_0099',
    sequence: 5,
    eventType: 'DECISION_OVERRIDDEN',
    occurredAt: new Date(),
    recordedAt: new Date(),
    sourceSystem: 'attacker-system',
    schemaVersion: 1,
    payload: { fake: true, approvedAmount: 5000000 },
    snapshotId: null,
    previousHash: 'forged_fake_hash_value_00000000000000000000000000000000000000000000',
    eventHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    hashAlgorithm: 'SHA-256',
  });

  const res2 = await verifyCase(TENANT_ID, CASE_ID);
  const test2Detected = !res2.chainConsistent || res2.failure != null;
  const test2Passed = test2Detected && (
    res2.failure?.reason === 'PREVIOUS_HASH_MISMATCH' ||
    res2.failure?.reason === 'EVENT_HASH_MISMATCH' ||
    res2.failure?.reason === 'SEQUENCE_GAP'
  );

  results.push({
    testNumber: 2,
    tamperAction: 'Insert Fake Event',
    injectedTamper: 'Inserted forged event at Seq #5 with fake previousHash',
    expectedDetection: 'PREVIOUS_HASH_MISMATCH at Seq #5',
    actualDetection: `${res2.failure?.reason || 'None'} at Seq #${res2.failure?.sequence || 'N/A'}`,
    status: test2Passed ? 'PASS' : 'FAIL',
    details: res2.failure?.details || 'Chain integrity violated',
  });
  console.log(`Result: ${test2Passed ? '✓ PASS' : '✗ FAIL'} (${res2.failure?.reason} at Seq #${res2.failure?.sequence})`);

  // Remove fake event and shift events 6..11 back to 5..10
  await LedgerEventModel.deleteOne({ _id: fakeEvent._id });
  for (let s = 6; s <= 11; s++) {
    await LedgerEventModel.updateOne(
      { tenantId: TENANT_ID, caseId: CASE_ID, sequence: s },
      { $set: { sequence: s - 1 } }
    );
  }
  const restoreRes2 = await verifyCase(TENANT_ID, CASE_ID);
  if (!restoreRes2.verified) throw new Error('Failed to restore after Test 2');

  // =========================================================================
  // TEST 3: Delete newest event (Seq #10, anchored by Checkpoint)
  // =========================================================================
  console.log('\n--- Running Test 3: Delete the newest event ---');
  const originalEvt10 = await LedgerEventModel.findOne({ tenantId: TENANT_ID, caseId: CASE_ID, sequence: 10 }).lean();
  if (!originalEvt10) throw new Error('Original event 10 not found');

  // Delete sequence 10 from DB
  await LedgerEventModel.deleteOne({ tenantId: TENANT_ID, caseId: CASE_ID, sequence: 10 });

  const res3 = await verifyCase(TENANT_ID, CASE_ID);
  const checkpointFailure = res3.checkpointFailures.find((cf) => cf.sequence === 10);
  const test3Detected = !res3.verified && (
    checkpointFailure?.reason === 'EVENT_MISSING_AFTER_CHECKPOINT' ||
    res3.checkpointStatus === 'MISMATCH' ||
    res3.failure?.reason === 'SEQUENCE_GAP'
  );

  results.push({
    testNumber: 3,
    tamperAction: 'Delete Newest Event (Seq #10)',
    injectedTamper: 'Deleted newest event (Seq #10) which was anchored by HMAC checkpoint',
    expectedDetection: 'EVENT_MISSING_AFTER_CHECKPOINT / Checkpoint MISMATCH',
    actualDetection: checkpointFailure?.reason || res3.checkpointStatus || 'Detected',
    status: test3Detected ? 'PASS' : 'FAIL',
    details: checkpointFailure?.details || `Checkpoint status: ${res3.checkpointStatus}`,
  });
  console.log(`Result: ${test3Detected ? '✓ PASS' : '✗ FAIL'} (${checkpointFailure?.reason || res3.checkpointStatus})`);

  // Cleanup test case from database
  await LedgerEventModel.deleteMany({ tenantId: TENANT_ID, caseId: CASE_ID });
  await CaseModel.deleteMany({ tenantId: TENANT_ID, caseId: CASE_ID });
  await CheckpointModel.deleteMany({ tenantId: TENANT_ID, caseId: CASE_ID });
  await mongoose.disconnect();

  // =========================================================================
  // PRINT FORMATTED RESULTS TABLE
  // =========================================================================
  console.log('\n' + '='.repeat(110));
  console.log('                          DECISIONTRACE TAMPER DETECTION TEST RESULTS TABLE');
  console.log('='.repeat(110));
  console.log(
    '| # | ' +
    'Tamper Action'.padEnd(28) + ' | ' +
    'Expected Detection'.padEnd(30) + ' | ' +
    'Actual Detection'.padEnd(30) + ' | ' +
    'Result |'
  );
  console.log('-'.repeat(110));

  for (const r of results) {
    console.log(
      `| ${r.testNumber} | ` +
      r.tamperAction.padEnd(28) + ' | ' +
      r.expectedDetection.padEnd(30) + ' | ' +
      r.actualDetection.padEnd(30) + ' | ' +
      ` ${r.status}  |`
    );
    console.log(`  └─ Details: ${r.details}`);
  }
  console.log('='.repeat(110));

  const allPassed = results.every((r) => r.status === 'PASS');
  if (allPassed) {
    console.log('🎉 ALL 3 TAMPER SCENARIOS SUCCESSFULLY DETECTED BY CRYPTOGRAPHIC ENGINE!\n');
  } else {
    console.error('❌ Some tamper scenarios were not detected.');
    process.exit(1);
  }
}

runTamperTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
