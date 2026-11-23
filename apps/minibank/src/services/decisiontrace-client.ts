/**
 * MiniBank DecisionTrace Client
 * 
 * Packages loan originations into canonical DecisionTrace audit events
 * and securely ingests them using the configured X-API-Key.
 */
import { config } from '../config.ts';
import type { LoanApplication, UnderwritingResult } from '../rules/underwriting.ts';

export interface DispatchResult {
  caseId: string;
  eventsDispatched: number;
  latestEventHash: string;
  decisionTraceUrl: string;
}

export async function dispatchLoanEvents(
  application: LoanApplication,
  decision: UnderwritingResult
): Promise<DispatchResult> {
  const timestamp = Date.now();
  const caseId = `minibank_loan_${timestamp}`;
  const subjectRef = `applicant_${application.applicantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Sequence of canonical events to send
  const events = [
    // 1. Case Created
    {
      eventId: `evt_mb_${timestamp}_01`,
      schemaVersion: 1,
      tenantId: config.tenantId,
      caseId,
      sourceSystem: config.sourceSystem,
      eventType: 'CASE_CREATED',
      occurredAt: new Date(timestamp - 2000).toISOString(),
      caseType: 'LOAN',
      subjectRef,
      payload: {
        application: {
          applicantName: application.applicantName,
          requestedAmount: application.requestedAmount,
          currency: 'INR',
          channel: 'MINIBANK_WEB_FORM',
        },
      },
    },
    // 2. Evidence Captured
    {
      eventId: `evt_mb_${timestamp}_02`,
      schemaVersion: 1,
      tenantId: config.tenantId,
      caseId,
      sourceSystem: config.sourceSystem,
      eventType: 'EVIDENCE_CAPTURED',
      occurredAt: new Date(timestamp - 1000).toISOString(),
      caseType: 'LOAN',
      subjectRef,
      payload: {
        evidence: {
          monthlyIncome: application.monthlyIncome,
          requestedAmount: application.requestedAmount,
          existingLoanAmount: application.existingDebt,
          creditBureauScore: application.creditScore,
          accountAgeMonths: application.accountAgeMonths,
          calculatedDti: decision.dtiRatio,
        },
        rules: {
          rulesetId: 'minibank-underwriting-rules',
          rulesetVersion: '1.0.0',
        },
      },
    },
    // 3. Decision Made
    {
      eventId: `evt_mb_${timestamp}_03`,
      schemaVersion: 1,
      tenantId: config.tenantId,
      caseId,
      sourceSystem: config.sourceSystem,
      eventType: 'DECISION_MADE',
      occurredAt: new Date(timestamp).toISOString(),
      caseType: 'LOAN',
      subjectRef,
      payload: {
        decision: {
          outcome: decision.outcome,
          riskScore: decision.riskScore,
          approvedAmount: decision.approvedAmount,
          currency: 'INR',
        },
        reasonCodes: decision.reasonCodes,
        rules: {
          rulesetId: 'minibank-underwriting-rules',
          rulesetVersion: '1.0.0',
        },
      },
    },
  ];

  // If approved, dispatch confirmation
  if (decision.outcome === 'APPROVED') {
    events.push({
      eventId: `evt_mb_${timestamp}_04`,
      schemaVersion: 1,
      tenantId: config.tenantId,
      caseId,
      sourceSystem: config.sourceSystem,
      eventType: 'APPROVAL_CONFIRMED',
      occurredAt: new Date(timestamp + 500).toISOString(),
      caseType: 'LOAN',
      subjectRef,
      payload: {
        finalAmount: decision.approvedAmount || application.requestedAmount,
        currency: 'INR',
        terms: {
          interestRate: 10.5,
          tenureMonths: 36,
        },
      },
    });
  }

  let latestHash = '';

  for (const evt of events) {
    const res = await fetch(`${config.decisionTraceApiUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.decisionTraceApiKey,
      },
      body: JSON.stringify(evt),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`DecisionTrace ingestion failed (${res.status}): ${errBody}`);
    }

    const resJson = await res.json();
    latestHash = resJson.data.eventHash;
  }

  return {
    caseId,
    eventsDispatched: events.length,
    latestEventHash: latestHash,
    decisionTraceUrl: `${config.decisionTraceUiUrl}`,
  };
}
