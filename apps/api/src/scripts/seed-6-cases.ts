/**
 * Seed 6 Varied Decision Cases for DecisionTrace
 * 
 * 1. case_prime_auto_approved_1001 (Prime auto-approved, low risk)
 * 2. case_high_risk_auto_rejected_1002 (Subprime auto-rejected, high risk)
 * 3. case_review_override_approved_1003 (Manual review overridden to approved)
 * 4. case_fraud_dispute_rejected_1004 (Manual review overridden to rejected)
 * 5. case_under_active_review_1005 (Currently under active underwriting review)
 * 6. case_commercial_anchored_checkpoint_1006 (Multi-event commercial case with HMAC checkpoint)
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { LedgerEventModel } from '../modules/events/event.model';
import { CaseModel } from '../modules/cases/case.model';
import { CheckpointModel } from '../modules/checkpoints/checkpoint.model';
import { SnapshotModel } from '../modules/events/snapshot.model';
import { ingestEvent } from '../modules/ledger/ledger.service';

const TENANT_ID = 'demo-bank';

const casesToSeed = [
  'case_prime_auto_approved_1001',
  'case_high_risk_auto_rejected_1002',
  'case_review_override_approved_1003',
  'case_fraud_dispute_rejected_1004',
  'case_under_active_review_1005',
  'case_commercial_anchored_checkpoint_1006',
];

async function seedSixCases() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/decisiontrace';
  console.log(`Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);

  console.log('Cleaning existing demo data for the 6 target cases...');
  for (const cId of casesToSeed) {
    await LedgerEventModel.deleteMany({ tenantId: TENANT_ID, caseId: cId });
    await CaseModel.deleteMany({ tenantId: TENANT_ID, caseId: cId });
    await CheckpointModel.deleteMany({ tenantId: TENANT_ID, caseId: cId });
    await SnapshotModel.deleteMany({ tenantId: TENANT_ID, caseId: cId });
  }

  // =========================================================================
  // Case 1: Prime Auto-Approved Loan (Low Risk 15/100)
  // =========================================================================
  console.log('Seeding Case 1: case_prime_auto_approved_1001 (Auto-Approved Prime)...');
  await ingestEvent({
    eventId: 'evt_prime_0001',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_prime_auto_approved_1001',
    sourceSystem: 'retail-los-engine',
    eventType: 'CASE_CREATED',
    occurredAt: '2026-11-21T09:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_salaried_priya',
    payload: {
      application: {
        requestedAmount: 600000,
        currency: 'INR',
        purpose: 'Home Improvement',
        channel: 'MOBILE_APP',
      },
    },
  });

  await ingestEvent({
    eventId: 'evt_prime_0002',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_prime_auto_approved_1001',
    sourceSystem: 'retail-los-engine',
    eventType: 'EVIDENCE_CAPTURED',
    occurredAt: '2026-11-21T09:05:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_salaried_priya',
    payload: {
      evidence: {
        monthlyIncome: 180000,
        existingLoanAmount: 50000,
        accountAgeMonths: 48,
        creditBureauScore: 810,
        employmentType: 'SALARIED_MNC',
      },
      rules: { rulesetId: 'prime-credit-policy', rulesetVersion: '2.1.0' },
    },
  });

  await ingestEvent({
    eventId: 'evt_prime_0003',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_prime_auto_approved_1001',
    sourceSystem: 'retail-los-engine',
    eventType: 'DECISION_MADE',
    occurredAt: '2026-11-21T09:06:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_salaried_priya',
    payload: {
      decision: { outcome: 'APPROVED', riskScore: 15, approvedAmount: 600000, currency: 'INR' },
      rules: { rulesetId: 'prime-credit-policy', rulesetVersion: '2.1.0' },
      model: { modelId: 'ml-credit-scorer', modelVersion: 'v1.4.0' },
      shapFactors: [
        { feature: 'creditBureauScore', feature_label: 'Credit Bureau Score', feature_value: 810, direction: 'reduces_risk', impact_percentage: 38.5 },
        { feature: 'monthlyIncome', feature_label: 'Monthly Income', feature_value: 180000, direction: 'reduces_risk', impact_percentage: 29.2 },
        { feature: 'accountAgeMonths', feature_label: 'Account Age', feature_value: 48, direction: 'reduces_risk', impact_percentage: 18.0 },
      ],
      reasonCodes: ['EXCELLENT_CREDIT_BUREAU_HISTORY', 'LOW_DEBT_TO_INCOME'],
    },
  });

  await ingestEvent({
    eventId: 'evt_prime_0004',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_prime_auto_approved_1001',
    sourceSystem: 'retail-los-engine',
    eventType: 'APPROVAL_CONFIRMED',
    occurredAt: '2026-11-21T09:10:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_salaried_priya',
    payload: { finalAmount: 600000, currency: 'INR', interestRate: 9.25, tenureMonths: 36 },
  });

  // =========================================================================
  // Case 2: Subprime Auto-Rejected Loan (High Risk 91/100)
  // =========================================================================
  console.log('Seeding Case 2: case_high_risk_auto_rejected_1002 (High Risk Auto-Rejected)...');
  await ingestEvent({
    eventId: 'evt_reject_0001',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_high_risk_auto_rejected_1002',
    sourceSystem: 'retail-los-engine',
    eventType: 'CASE_CREATED',
    occurredAt: '2026-11-21T10:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_overleveraged_rahul',
    payload: {
      application: { requestedAmount: 800000, currency: 'INR', purpose: 'Debt Consolidation', channel: 'WEB_PORTAL' },
    },
  });

  await ingestEvent({
    eventId: 'evt_reject_0002',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_high_risk_auto_rejected_1002',
    sourceSystem: 'retail-los-engine',
    eventType: 'EVIDENCE_CAPTURED',
    occurredAt: '2026-11-21T10:08:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_overleveraged_rahul',
    payload: {
      evidence: {
        monthlyIncome: 32000,
        existingLoanAmount: 450000,
        accountAgeMonths: 4,
        creditBureauScore: 540,
        delinquenciesLast12M: 3,
      },
      rules: { rulesetId: 'standard-risk-policy', rulesetVersion: '1.2.0' },
    },
  });

  await ingestEvent({
    eventId: 'evt_reject_0003',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_high_risk_auto_rejected_1002',
    sourceSystem: 'retail-los-engine',
    eventType: 'DECISION_MADE',
    occurredAt: '2026-11-21T10:10:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_overleveraged_rahul',
    payload: {
      decision: { outcome: 'REJECTED', riskScore: 91, currency: 'INR' },
      rules: { rulesetId: 'standard-risk-policy', rulesetVersion: '1.2.0' },
      model: { modelId: 'ml-credit-scorer', modelVersion: 'v1.4.0' },
      shapFactors: [
        { feature: 'existingLoanAmount', feature_label: 'Existing Loan Balance', feature_value: 450000, direction: 'increases_risk', impact_percentage: 42.1 },
        { feature: 'creditBureauScore', feature_label: 'Subprime Credit Score', feature_value: 540, direction: 'increases_risk', impact_percentage: 36.8 },
        { feature: 'accountAgeMonths', feature_label: 'Account Age', feature_value: 4, direction: 'increases_risk', impact_percentage: 15.3 },
      ],
      reasonCodes: ['EXCESSIVE_DTI_EXCEEDS_60_PCT', 'SUBPRIME_CREDIT_SCORE', 'MULTIPLE_RECENT_DELINQUENCIES'],
    },
  });

  await ingestEvent({
    eventId: 'evt_reject_0004',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_high_risk_auto_rejected_1002',
    sourceSystem: 'retail-los-engine',
    eventType: 'CASE_CLOSED',
    occurredAt: '2026-11-21T10:15:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_overleveraged_rahul',
    payload: { reason: 'Application declined under automated underwriting threshold' },
  });

  // =========================================================================
  // Case 3: Manual Review with Human Override to APPROVED
  // =========================================================================
  console.log('Seeding Case 3: case_review_override_approved_1003 (Override to APPROVED)...');
  await ingestEvent({
    eventId: 'evt_overapp_0001',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_review_override_approved_1003',
    sourceSystem: 'retail-los-engine',
    eventType: 'CASE_CREATED',
    occurredAt: '2026-11-21T11:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_business_ananya',
    payload: {
      application: { requestedAmount: 500000, currency: 'INR', purpose: 'Working Capital', businessType: 'RETAIL' },
    },
  });

  await ingestEvent({
    eventId: 'evt_overapp_0002',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_review_override_approved_1003',
    sourceSystem: 'retail-los-engine',
    eventType: 'EVIDENCE_CAPTURED',
    occurredAt: '2026-11-21T11:15:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_business_ananya',
    payload: {
      evidence: {
        monthlyIncome: 95000,
        existingLoanAmount: 180000,
        accountAgeMonths: 11,
        creditBureauScore: 670,
        gstTurnoverAnnual: 4200000,
      },
      rules: { rulesetId: 'sme-underwriting-rules', rulesetVersion: '1.0.0' },
    },
  });

  await ingestEvent({
    eventId: 'evt_overapp_0003',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_review_override_approved_1003',
    sourceSystem: 'retail-los-engine',
    eventType: 'DECISION_MADE',
    occurredAt: '2026-11-21T11:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_business_ananya',
    payload: {
      decision: { outcome: 'MANUAL_REVIEW', riskScore: 62, currency: 'INR' },
      rules: { rulesetId: 'sme-underwriting-rules', rulesetVersion: '1.0.0' },
      model: { modelId: 'ml-credit-scorer', modelVersion: 'v1.4.0' },
      shapFactors: [
        { feature: 'accountAgeMonths', feature_label: 'Short Account Tenure', feature_value: 11, direction: 'increases_risk', impact_percentage: 27.5 },
        { feature: 'existingLoanAmount', feature_label: 'Existing Obligations', feature_value: 180000, direction: 'increases_risk', impact_percentage: 22.0 },
        { feature: 'creditBureauScore', feature_label: 'Credit Score', feature_value: 670, direction: 'reduces_risk', impact_percentage: 16.5 },
      ],
      reasonCodes: ['SHORT_ACCOUNT_HISTORY', 'REQUIRES_CASHFLOW_AUDIT'],
    },
  });

  await ingestEvent({
    eventId: 'evt_overapp_0004',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_review_override_approved_1003',
    sourceSystem: 'workflow-orchestrator',
    eventType: 'REVIEW_REQUESTED',
    occurredAt: '2026-11-21T12:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_business_ananya',
    payload: {
      reviewType: 'CREDIT_COMMITTEE_ESCALATION',
      assignedTo: 'senior_credit_officer_vikram',
      reason: 'Moderate risk score with strong audited GST sales receipts',
    },
  });

  await ingestEvent({
    eventId: 'evt_overapp_0005',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_review_override_approved_1003',
    sourceSystem: 'underwriting-portal',
    eventType: 'DECISION_OVERRIDDEN',
    occurredAt: '2026-11-21T14:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_business_ananya',
    payload: {
      override: {
        originalOutcome: 'MANUAL_REVIEW',
        newOutcome: 'APPROVED',
        approvedAmount: 400000,
        currency: 'INR',
      },
      reviewedBy: 'senior_credit_officer_vikram',
      approver: 'Senior Credit Officer Vikramaditya',
      reason: 'Audited GST records demonstrate consistent operating cashflows of ₹4.2M. Personal property hypothecation provided. Approved with reduced limit per Credit Committee Policy §4.2.',
      rules: { rulesetId: 'supervisory-override-policy', rulesetVersion: '2.0.0' },
    },
  });

  await ingestEvent({
    eventId: 'evt_overapp_0006',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_review_override_approved_1003',
    sourceSystem: 'retail-los-engine',
    eventType: 'APPROVAL_CONFIRMED',
    occurredAt: '2026-11-21T15:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_business_ananya',
    payload: { finalAmount: 400000, currency: 'INR', interestRate: 11.75, tenureMonths: 24 },
  });

  // =========================================================================
  // Case 4: Review Overridden to REJECTED (Fraud / Document Anomaly)
  // =========================================================================
  console.log('Seeding Case 4: case_fraud_dispute_rejected_1004 (Override to REJECTED)...');
  await ingestEvent({
    eventId: 'evt_fraud_0001',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_fraud_dispute_rejected_1004',
    sourceSystem: 'retail-los-engine',
    eventType: 'CASE_CREATED',
    occurredAt: '2026-11-22T08:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_applicant_karan',
    payload: { application: { requestedAmount: 750000, currency: 'INR', purpose: 'Personal Loan' } },
  });

  await ingestEvent({
    eventId: 'evt_fraud_0002',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_fraud_dispute_rejected_1004',
    sourceSystem: 'retail-los-engine',
    eventType: 'EVIDENCE_CAPTURED',
    occurredAt: '2026-11-22T08:45:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_applicant_karan',
    payload: {
      evidence: {
        monthlyIncome: 70000,
        existingLoanAmount: 90000,
        accountAgeMonths: 14,
        creditBureauScore: 690,
      },
      rules: { rulesetId: 'standard-risk-policy', rulesetVersion: '1.2.0' },
    },
  });

  await ingestEvent({
    eventId: 'evt_fraud_0003',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_fraud_dispute_rejected_1004',
    sourceSystem: 'retail-los-engine',
    eventType: 'DECISION_MADE',
    occurredAt: '2026-11-22T09:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_applicant_karan',
    payload: {
      decision: { outcome: 'MANUAL_REVIEW', riskScore: 58, currency: 'INR' },
      rules: { rulesetId: 'standard-risk-policy', rulesetVersion: '1.2.0' },
      model: { modelId: 'ml-credit-scorer', modelVersion: 'v1.4.0' },
      shapFactors: [
        { feature: 'monthlyIncome', feature_label: 'Reported Salary', feature_value: 70000, direction: 'reduces_risk', impact_percentage: 24.0 },
        { feature: 'creditBureauScore', feature_label: 'Fair Credit Bureau', feature_value: 690, direction: 'reduces_risk', impact_percentage: 21.0 },
      ],
      reasonCodes: ['SUSPICIOUS_EMPLOYER_DOMAIN', 'DOC_VERIFICATION_PENDING'],
    },
  });

  await ingestEvent({
    eventId: 'evt_fraud_0004',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_fraud_dispute_rejected_1004',
    sourceSystem: 'fraud-prevention-system',
    eventType: 'REVIEW_REQUESTED',
    occurredAt: '2026-11-22T09:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_applicant_karan',
    payload: {
      reviewType: 'FRAUD_DOCUMENT_INVESTIGATION',
      assignedTo: 'fraud_risk_lead_meera',
      reason: 'Automated OCR flagged digital font tamper in salary PDF statement',
    },
  });

  await ingestEvent({
    eventId: 'evt_fraud_0005',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_fraud_dispute_rejected_1004',
    sourceSystem: 'underwriting-portal',
    eventType: 'DECISION_OVERRIDDEN',
    occurredAt: '2026-11-22T11:15:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_applicant_karan',
    payload: {
      override: { originalOutcome: 'MANUAL_REVIEW', newOutcome: 'REJECTED' },
      reviewedBy: 'fraud_risk_lead_meera',
      approver: 'Meera Sengupta (Fraud Risk Lead)',
      reason: 'Physical employer verification failed; company domain registered 12 days ago. Forged salary slip confirmed by issuing bank. Overridden to REJECTED.',
      rules: { rulesetId: 'fraud-policy-directive', rulesetVersion: '3.0.0' },
    },
  });

  await ingestEvent({
    eventId: 'evt_fraud_0006',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_fraud_dispute_rejected_1004',
    sourceSystem: 'retail-los-engine',
    eventType: 'CASE_CLOSED',
    occurredAt: '2026-11-22T11:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_applicant_karan',
    payload: { reason: 'Application terminated for fraudulent documentation' },
  });

  // =========================================================================
  // Case 5: Borderline High-Risk Case Under Active Review
  // =========================================================================
  console.log('Seeding Case 5: case_under_active_review_1005 (Under Active Review)...');
  await ingestEvent({
    eventId: 'evt_actrev_0001',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_under_active_review_1005',
    sourceSystem: 'retail-los-engine',
    eventType: 'CASE_CREATED',
    occurredAt: '2026-11-22T14:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_consultant_siddharth',
    payload: {
      application: { requestedAmount: 1200000, currency: 'INR', purpose: 'Professional Equipment' },
    },
  });

  await ingestEvent({
    eventId: 'evt_actrev_0002',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_under_active_review_1005',
    sourceSystem: 'retail-los-engine',
    eventType: 'EVIDENCE_CAPTURED',
    occurredAt: '2026-11-22T14:15:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_consultant_siddharth',
    payload: {
      evidence: {
        monthlyIncome: 110000,
        existingLoanAmount: 300000,
        accountAgeMonths: 18,
        creditBureauScore: 660,
        profession: 'INDEPENDENT_SOFTWARE_CONSULTANT',
      },
      rules: { rulesetId: 'consultant-lending-rules', rulesetVersion: '1.0.0' },
    },
  });

  await ingestEvent({
    eventId: 'evt_actrev_0003',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_under_active_review_1005',
    sourceSystem: 'retail-los-engine',
    eventType: 'DECISION_MADE',
    occurredAt: '2026-11-22T14:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_consultant_siddharth',
    payload: {
      decision: { outcome: 'MANUAL_REVIEW', riskScore: 68, currency: 'INR' },
      rules: { rulesetId: 'consultant-lending-rules', rulesetVersion: '1.0.0' },
      model: { modelId: 'ml-credit-scorer', modelVersion: 'v1.4.0' },
      shapFactors: [
        { feature: 'requestedAmount', feature_label: 'High Loan Quantum', feature_value: 1200000, direction: 'increases_risk', impact_percentage: 31.0 },
        { feature: 'existingLoanAmount', feature_label: 'Existing Obligations', feature_value: 300000, direction: 'increases_risk', impact_percentage: 24.5 },
        { feature: 'monthlyIncome', feature_label: 'Consulting Income', feature_value: 110000, direction: 'reduces_risk', impact_percentage: 17.5 },
      ],
      reasonCodes: ['HIGH_QUANTUM_RELATIVE_TO_VOLATILE_INCOME', 'SECOND_LEVEL_SIGN_OFF_REQUIRED'],
    },
  });

  await ingestEvent({
    eventId: 'evt_actrev_0004',
    schemaVersion: 1,
    tenantId: TENANT_ID,
    caseId: 'case_under_active_review_1005',
    sourceSystem: 'workflow-orchestrator',
    eventType: 'REVIEW_REQUESTED',
    occurredAt: '2026-11-22T14:45:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_consultant_siddharth',
    payload: {
      reviewType: 'SENIOR_CREDIT_REVIEW',
      assignedTo: 'senior_credit_lead_arjun',
      reason: 'Underwriting pending client tax returns verification for previous 2 financial years',
    },
  });

  // =========================================================================
  // Case 6: Multi-Event Commercial Loan Anchored with HMAC Checkpoint (11 Events)
  // =========================================================================
  console.log('Seeding Case 6: case_commercial_anchored_checkpoint_1006 (Checkpoint Anchored)...');
  const commercialEvents = [
    { type: 'CASE_CREATED', payload: { application: { requestedAmount: 2500000, entity: 'Solaris Agro-Industries LLP' } } },
    { type: 'EVIDENCE_CAPTURED', payload: { evidence: { annualTurnover: 18000000, debtServiceCoverage: 2.1 } } },
    { type: 'EVIDENCE_CAPTURED', payload: { evidence: { equipmentAssetValue: 3400000, vendor: 'Siemens Precision' } } },
    { type: 'EVIDENCE_CAPTURED', payload: { evidence: { taxComplianceStatus: 'CERTIFIED_CLEAR', cinNumber: 'U01100MH2021PTC123456' } } },
    { type: 'DECISION_MADE', payload: { decision: { outcome: 'MANUAL_REVIEW', riskScore: 42 }, rules: { rulesetId: 'commercial-equip-policy', rulesetVersion: '2.0.0' } } },
    { type: 'REVIEW_REQUESTED', payload: { reviewType: 'COMMERCIAL_RISK_BOARD', assignedTo: 'board_chair_nair' } },
    { type: 'EVIDENCE_CAPTURED', payload: { evidence: { boardResolutionSigned: true, quorumVerified: true } } },
    { type: 'EVIDENCE_CAPTURED', payload: { evidence: { directorPersonalGuarantee: 'UNCONDITIONAL_EXECUTION' } } },
    { type: 'EVIDENCE_CAPTURED', payload: { evidence: { externalAuditorComfortLetter: 'AFFIRMATIVE' } } },
    {
      type: 'DECISION_OVERRIDDEN',
      payload: {
        override: { originalOutcome: 'MANUAL_REVIEW', newOutcome: 'APPROVED', approvedAmount: 2500000 },
        approver: 'Executive Credit Committee (Board)',
        reason: 'Asset coverage ratio exceeds 135%. Unconditional corporate and director guarantees secured. Full approval sanctioned.',
      },
    },
    { type: 'APPROVAL_CONFIRMED', payload: { finalAmount: 2500000, interestRate: 10.5, repaymentTenureMonths: 60 } },
  ];

  for (let i = 0; i < commercialEvents.length; i++) {
    const ce = commercialEvents[i];
    await ingestEvent({
      eventId: `evt_comm_${(i + 1).toString().padStart(4, '0')}`,
      schemaVersion: 1,
      tenantId: TENANT_ID,
      caseId: 'case_commercial_anchored_checkpoint_1006',
      sourceSystem: 'commercial-loan-core',
      eventType: ce.type as any,
      occurredAt: new Date(Date.now() - (commercialEvents.length - i) * 3600000).toISOString(),
      caseType: 'LOAN',
      subjectRef: 'subj_enterprise_solaris',
      payload: ce.payload as any,
    });
  }

  console.log('\n✓ All 6 varied cases seeded successfully into MongoDB!\n');

  // Verify all 6 cases
  for (const cId of casesToSeed) {
    const cDoc = await CaseModel.findOne({ tenantId: TENANT_ID, caseId: cId });
    console.log(`- ${cId.padEnd(45)} | Status: ${cDoc?.status.padEnd(12)} | Decision: ${cDoc?.latestDecision || 'None'}`);
  }

  await mongoose.disconnect();
}

seedSixCases().catch((err) => {
  console.error('Failed to seed cases:', err);
  process.exit(1);
});
