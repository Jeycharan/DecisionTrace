/**
 * Versioned Deterministic Rules Registry
 * 
 * Preserves historical rule implementations so decisions can be replayed
 * against the EXACT version in effect at the time of the decision.
 * 
 * Per spec: Replay must NOT silently use the latest version.
 * If a requested historical version is not present, it must fail explicitly.
 */

export interface RuleEvaluationInput {
  application?: {
    requestedAmount?: number;
    monthlyIncome?: number;
    existingLoanAmount?: number;
    accountAgeMonths?: number;
    purpose?: string;
  };
  evidence?: {
    monthlyIncome?: number;
    existingLoanAmount?: number;
    accountAgeMonths?: number;
    creditBureauScore?: number;
  };
  [key: string]: unknown;
}

export interface RuleEvaluationResult {
  outcome: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  riskScore: number;
  reasonCodes: string[];
}

export type RuleEngineFn = (input: RuleEvaluationInput) => RuleEvaluationResult;

/**
 * Registry of versioned rule engines:
 * key: `${rulesetId}@${version}`
 */
const registry: Record<string, RuleEngineFn> = {};

/**
 * Register a deterministic rule engine version.
 */
export function registerRuleVersion(
  rulesetId: string,
  version: string,
  fn: RuleEngineFn
): void {
  registry[`${rulesetId}@${version}`] = fn;
}

/**
 * Get a specific rule engine version.
 * Throws if the exact version is not available.
 */
export function getRuleEngine(rulesetId: string, version: string): RuleEngineFn {
  const key = `${rulesetId}@${version}`;
  const fn = registry[key];
  if (!fn) {
    throw new Error(
      `Historical rule version '${key}' is not available in the rules registry. ` +
      `DecisionTrace will not silently fallback to a newer version.`
    );
  }
  return fn;
}

/**
 * Check if a rule version exists.
 */
export function hasRuleVersion(rulesetId: string, version: string): boolean {
  return `${rulesetId}@${version}` in registry;
}

// ---------------------------------------------------------------------------
// Standard Demo Rule Implementations
// ---------------------------------------------------------------------------

/**
 * loan-policy @ 1.0.0
 * Initial baseline underwriting policy.
 */
registerRuleVersion('loan-policy', '1.0.0', (input) => {
  const app = input.application || (input.evidence as typeof input.application) || {};
  const income = app.monthlyIncome || 0;
  const existingLoans = app.existingLoanAmount || 0;
  const requested = app.requestedAmount || 0;
  const accountAge = app.accountAgeMonths || 0;

  const reasonCodes: string[] = [];
  let riskScore = 40; // baseline

  // 1. Minimum income check
  if (income < 20000) {
    reasonCodes.push('INSUFFICIENT_INCOME');
    riskScore += 45;
  }

  // 2. Debt-to-income / existing obligations
  const annualIncome = income * 12;
  if (annualIncome > 0 && existingLoans / annualIncome > 0.35) {
    reasonCodes.push('HIGH_EXISTING_OBLIGATION');
    riskScore += 25;
  }

  // 3. Short account tenure
  if (accountAge < 12) {
    reasonCodes.push('SHORT_ACCOUNT_HISTORY');
    riskScore += 17;
  }

  // 4. Excessive loan amount relative to income
  if (income > 0 && requested > income * 15) {
    reasonCodes.push('EXCESSIVE_REQUESTED_AMOUNT');
    riskScore += 20;
  }

  // Cap risk score at 100
  riskScore = Math.min(100, riskScore);

  let outcome: RuleEvaluationResult['outcome'] = 'APPROVED';
  if (riskScore >= 80) {
    outcome = reasonCodes.includes('INSUFFICIENT_INCOME') ? 'REJECTED' : 'MANUAL_REVIEW';
  } else if (riskScore >= 60) {
    outcome = 'MANUAL_REVIEW';
  }

  return {
    outcome,
    riskScore,
    reasonCodes,
  };
});

/**
 * loan-policy @ 1.1.0
 * Updated policy: relaxed account history requirement to 6 months.
 */
registerRuleVersion('loan-policy', '1.1.0', (input) => {
  const app = input.application || (input.evidence as typeof input.application) || {};
  const income = app.monthlyIncome || 0;
  const existingLoans = app.existingLoanAmount || 0;
  const requested = app.requestedAmount || 0;
  const accountAge = app.accountAgeMonths || 0;

  const reasonCodes: string[] = [];
  let riskScore = 35; // lower baseline

  if (income < 20000) {
    reasonCodes.push('INSUFFICIENT_INCOME');
    riskScore += 45;
  }

  const annualIncome = income * 12;
  if (annualIncome > 0 && existingLoans / annualIncome > 0.40) {
    reasonCodes.push('HIGH_EXISTING_OBLIGATION');
    riskScore += 25;
  }

  // Relaxed threshold: only penalise if < 6 months
  if (accountAge < 6) {
    reasonCodes.push('SHORT_ACCOUNT_HISTORY');
    riskScore += 15;
  }

  if (income > 0 && requested > income * 15) {
    reasonCodes.push('EXCESSIVE_REQUESTED_AMOUNT');
    riskScore += 20;
  }

  riskScore = Math.min(100, riskScore);

  let outcome: RuleEvaluationResult['outcome'] = 'APPROVED';
  if (riskScore >= 80) {
    outcome = 'REJECTED';
  } else if (riskScore >= 60) {
    outcome = 'MANUAL_REVIEW';
  }

  return {
    outcome,
    riskScore,
    reasonCodes,
  };
});
