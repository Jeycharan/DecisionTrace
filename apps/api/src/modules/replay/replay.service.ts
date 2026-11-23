import { SnapshotModel } from '../events/snapshot.model';
import { LedgerEventModel } from '../events/event.model';
import { CaseModel } from '../cases/case.model';
import { getRuleEngine, hasRuleVersion, RuleEvaluationResult } from './rules-registry';
import { NotFoundError, AppError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export interface ReplayComparison {
  caseId: string;
  snapshotId: string | null;
  sourceEventId: string;
  rulesetId: string;
  rulesetVersion: string;
  modelVersion: string | null;
  replayedAt: string;
  versionStatus: 'VERSION_AVAILABLE' | 'VERSION_UNAVAILABLE';
  reproducible: boolean;
  original: {
    outcome: string;
    riskScore: number | null;
    reasonCodes: string[];
  };
  replayed: {
    outcome: string;
    riskScore: number | null;
    reasonCodes: string[];
  } | null;
  differences: string[];
  explanation: string;
}

/**
 * Replay a case's decision using the immutable stored snapshot and versioned rules.
 */
export async function replayDecision(
  tenantId: string,
  caseId: string
): Promise<ReplayComparison> {
  const replayedAt = new Date().toISOString();

  // 1. Verify case exists
  const caseDoc = await CaseModel.findOne({ tenantId, caseId }).lean();
  if (!caseDoc) {
    throw new NotFoundError('Case', caseId);
  }

  // 2. Find decision event or latest snapshot
  const decisionEvent = await LedgerEventModel.findOne({
    tenantId,
    caseId,
    eventType: 'DECISION_MADE',
  })
    .sort({ sequence: -1 })
    .lean();

  if (!decisionEvent) {
    throw new AppError(
      400,
      'NO_DECISION_EVENT',
      `No 'DECISION_MADE' event found for case '${caseId}'. Replay requires a decision event.`
    );
  }

  // 3. Find associated snapshot
  let snapshot = null;
  if (decisionEvent.snapshotId) {
    snapshot = await SnapshotModel.findOne({
      tenantId,
      snapshotId: decisionEvent.snapshotId,
    }).lean();
  }

  const payload = decisionEvent.payload as Record<string, unknown>;
  const decision = (payload?.decision as Record<string, unknown>) || {};
  const rules = (payload?.rules as Record<string, unknown>) || {};
  const model = (payload?.model as Record<string, unknown>) || {};

  const rulesetId = (snapshot?.rulesetId || rules?.rulesetId || 'loan-policy') as string;
  const rulesetVersion = (snapshot?.rulesetVersion || rules?.rulesetVersion || '1.0.0') as string;
  const modelVersion = (snapshot?.modelVersion || model?.modelVersion || null) as string | null;

  const originalOutcome = (decision?.outcome as string) || 'UNKNOWN';
  const originalRiskScore = decision?.riskScore != null ? Number(decision.riskScore) : null;
  const originalReasonCodes = (payload?.reasonCodes as string[]) || [];

  const originalData = {
    outcome: originalOutcome,
    riskScore: originalRiskScore,
    reasonCodes: originalReasonCodes,
  };

  // 4. Check if exact rule version exists in registry
  if (!hasRuleVersion(rulesetId, rulesetVersion)) {
    return {
      caseId,
      snapshotId: decisionEvent.snapshotId || null,
      sourceEventId: decisionEvent.eventId,
      rulesetId,
      rulesetVersion,
      modelVersion,
      replayedAt,
      versionStatus: 'VERSION_UNAVAILABLE',
      reproducible: false,
      original: originalData,
      replayed: null,
      differences: [
        `Historical ruleset version '${rulesetId}@${rulesetVersion}' is not available in the rule engine registry.`,
      ],
      explanation:
        `Replay aborted to preserve audit integrity: DecisionTrace does not silently substitute newer rule versions. ` +
        `The exact rule logic version registered at the time of the decision must be supplied.`,
    };
  }

  // 5. Evaluate with exact versioned rule engine
  const ruleEngine = getRuleEngine(rulesetId, rulesetVersion);

  // Evidence comes directly from snapshot (or decision event payload application)
  const evidenceInput = (snapshot?.evidence as Record<string, unknown>) || payload;
  const replayedOutput: RuleEvaluationResult = ruleEngine(evidenceInput);

  // 6. Compare original vs replayed
  const differences: string[] = [];

  if (originalOutcome !== replayedOutput.outcome) {
    differences.push(
      `Outcome divergence: original was '${originalOutcome}', replayed evaluated to '${replayedOutput.outcome}'`
    );
  }

  if (
    originalRiskScore != null &&
    Math.abs(originalRiskScore - replayedOutput.riskScore) > 0.001
  ) {
    differences.push(
      `Risk score difference: original was ${originalRiskScore}, replayed evaluated to ${replayedOutput.riskScore}`
    );
  }

  // Compare reason codes
  const missingReasons = originalReasonCodes.filter(
    (code) => !replayedOutput.reasonCodes.includes(code)
  );
  const extraReasons = replayedOutput.reasonCodes.filter(
    (code) => !originalReasonCodes.includes(code)
  );

  if (missingReasons.length > 0) {
    differences.push(`Reason codes missing in replay: ${missingReasons.join(', ')}`);
  }
  if (extraReasons.length > 0) {
    differences.push(`Additional reason codes generated in replay: ${extraReasons.join(', ')}`);
  }

  const reproducible = differences.length === 0;

  logger.info('Decision replayed', {
    caseId,
    rulesetId,
    rulesetVersion,
    reproducible,
  });

  return {
    caseId,
    snapshotId: decisionEvent.snapshotId || null,
    sourceEventId: decisionEvent.eventId,
    rulesetId,
    rulesetVersion,
    modelVersion,
    replayedAt,
    versionStatus: 'VERSION_AVAILABLE',
    reproducible,
    original: originalData,
    replayed: {
      outcome: replayedOutput.outcome,
      riskScore: replayedOutput.riskScore,
      reasonCodes: replayedOutput.reasonCodes,
    },
    differences,
    explanation: reproducible
      ? `The decision is 100% reproducible. Running the exact frozen evidence through ruleset '${rulesetId}@${rulesetVersion}' yielded identical outcome, score, and reason codes.`
      : `Discrepancy detected between original record and replayed logic: ${differences.join('; ')}.`,
  };
}
