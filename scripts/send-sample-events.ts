/**
 * Send sample events to DecisionTrace API.
 * Simulates a realistic loan decision lifecycle.
 * 
 * Usage: npx ts-node scripts/send-sample-events.ts [API_KEY]
 */
const API_BASE = process.env.API_URL || 'http://localhost:5000/api/v1';

const events = [
  {
    eventId: 'evt_demo_0001',
    schemaVersion: 1,
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sourceSystem: 'demo-loan-engine',
    eventType: 'CASE_CREATED',
    occurredAt: '2026-11-20T10:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_demo_1001',
    payload: {
      description: 'New loan application received',
      application: {
        requestedAmount: 500000,
        currency: 'INR',
        purpose: 'Personal Loan',
      },
    },
  },
  {
    eventId: 'evt_demo_0002',
    schemaVersion: 1,
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sourceSystem: 'demo-loan-engine',
    eventType: 'EVIDENCE_CAPTURED',
    occurredAt: '2026-11-20T10:15:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_demo_1001',
    payload: {
      evidence: {
        monthlyIncome: 45000,
        existingLoanAmount: 200000,
        accountAgeMonths: 8,
        creditBureauScore: 680,
      },
      rules: {
        rulesetId: 'loan-evidence-collection',
        rulesetVersion: '1.0.0',
      },
    },
  },
  {
    eventId: 'evt_demo_0003',
    schemaVersion: 1,
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sourceSystem: 'demo-loan-engine',
    eventType: 'DECISION_MADE',
    occurredAt: '2026-11-20T10:30:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_demo_1001',
    payload: {
      application: {
        requestedAmount: 500000,
        monthlyIncome: 45000,
        existingLoanAmount: 200000,
        accountAgeMonths: 8,
      },
      decision: {
        outcome: 'MANUAL_REVIEW',
        riskScore: 82,
        currency: 'INR',
      },
      reasonCodes: ['SHORT_ACCOUNT_HISTORY', 'HIGH_EXISTING_OBLIGATION'],
      rules: {
        rulesetId: 'loan-policy',
        rulesetVersion: '1.0.0',
      },
      model: {
        modelId: 'credit-risk-demo',
        modelVersion: 'model_v1',
      },
    },
  },
  {
    eventId: 'evt_demo_0004',
    schemaVersion: 1,
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sourceSystem: 'demo-loan-engine',
    eventType: 'REVIEW_REQUESTED',
    occurredAt: '2026-11-20T11:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_demo_1001',
    payload: {
      reviewType: 'SENIOR_CREDIT_OFFICER',
      reason: 'High risk score with short account history',
      assignedTo: 'reviewer_001',
    },
  },
  {
    eventId: 'evt_demo_0005',
    schemaVersion: 1,
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sourceSystem: 'demo-loan-engine',
    eventType: 'DECISION_OVERRIDDEN',
    occurredAt: '2026-11-20T14:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_demo_1001',
    payload: {
      override: {
        originalOutcome: 'MANUAL_REVIEW',
        newOutcome: 'APPROVED',
        approvedAmount: 400000,
        currency: 'INR',
      },
      reason: 'Stable employment verified. Reduced amount approved per DTI guidelines.',
      reviewedBy: 'reviewer_001',
      rules: {
        rulesetId: 'override-policy',
        rulesetVersion: '1.0.0',
      },
    },
  },
  {
    eventId: 'evt_demo_0006',
    schemaVersion: 1,
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sourceSystem: 'demo-loan-engine',
    eventType: 'APPROVAL_CONFIRMED',
    occurredAt: '2026-11-20T15:00:00.000Z',
    caseType: 'LOAN',
    subjectRef: 'subj_demo_1001',
    payload: {
      finalAmount: 400000,
      currency: 'INR',
      terms: {
        interestRate: 12.5,
        tenureMonths: 36,
      },
    },
  },
];

async function sendEvents() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('Usage: npx ts-node scripts/send-sample-events.ts <API_KEY>');
    console.error('Get your API key by running: npm run seed');
    process.exit(1);
  }

  console.log(`Sending ${events.length} sample events to ${API_BASE}/events\n`);

  for (const event of events) {
    try {
      const response = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(event),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(
          `✓ ${event.eventType} (${event.eventId}) → seq ${data.data.sequence}, ` +
          `hash: ${data.data.eventHash.slice(0, 16)}...` +
          (data.data.idempotentReplay ? ' [replay]' : '') +
          (data.data.checkpointCreated ? ' [checkpoint]' : '')
        );
      } else {
        console.error(`✗ ${event.eventType} (${event.eventId}): ${JSON.stringify(data.error)}`);
      }
    } catch (error) {
      console.error(`✗ ${event.eventType} (${event.eventId}): ${error}`);
    }

    // Small delay between events for realistic demo
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log('\nDone! Check the dashboard or run verification.');
}

sendEvents();
