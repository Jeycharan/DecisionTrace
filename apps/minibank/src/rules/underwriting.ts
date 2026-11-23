/**
 * MiniBank Rule-Based Underwriting Engine
 * 
 * Evaluates basic debt-to-income, credit score, and tenure to produce
 * a deterministic decision outcome: APPROVED, MANUAL_REVIEW, or REJECTED.
 */
export interface LoanApplication {
  applicantName: string;
  monthlyIncome: number;
  requestedAmount: number;
  existingDebt: number;
  creditScore: number;
  accountAgeMonths: number;
}

export interface UnderwritingResult {
  outcome: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
  riskScore: number; // 0-100
  dtiRatio: number; // Debt-to-income ratio %
  reasonCodes: string[];
  approvedAmount?: number;
  policyVersion: string;
}

export function evaluateLoanRules(app: LoanApplication): UnderwritingResult {
  const policyVersion = 'minibank-underwriting-rules@1.0.0';
  const reasonCodes: string[] = [];

  // Estimated monthly debt service: existing monthly payment ~ 5% of existing balance + new EMI ~ 3% of requested
  const estimatedMonthlyDebt = app.existingDebt * 0.05 + app.requestedAmount * 0.03;
  const dtiRatio = Math.round((estimatedMonthlyDebt / app.monthlyIncome) * 100);

  // Compute baseline risk score (0 = lowest risk, 100 = highest risk)
  let riskScore = 40;

  // Credit Score adjustments
  if (app.creditScore >= 750) {
    riskScore -= 25;
  } else if (app.creditScore >= 680) {
    riskScore -= 10;
  } else if (app.creditScore < 600) {
    riskScore += 35;
    reasonCodes.push('SUBPRIME_CREDIT_SCORE');
  }

  // DTI adjustments
  if (dtiRatio > 55) {
    riskScore += 30;
    reasonCodes.push('EXCESSIVE_DTI_BURDEN');
  } else if (dtiRatio > 40) {
    riskScore += 15;
    reasonCodes.push('MODERATE_DTI_ELEVATED');
  } else {
    riskScore -= 10;
  }

  // Account Age
  if (app.accountAgeMonths < 6) {
    riskScore += 15;
    reasonCodes.push('SHORT_ACCOUNT_HISTORY');
  }

  // Bound risk score between 5 and 95
  riskScore = Math.max(5, Math.min(95, riskScore));

  // Determine outcome
  if (riskScore <= 35 && app.creditScore >= 700 && dtiRatio <= 45) {
    reasonCodes.push('EXCELLENT_CREDIT_PROFILE');
    return {
      outcome: 'APPROVED',
      riskScore,
      dtiRatio,
      reasonCodes,
      approvedAmount: app.requestedAmount,
      policyVersion,
    };
  }

  if (riskScore >= 70 || app.creditScore < 580 || dtiRatio > 65) {
    reasonCodes.push('RISK_THRESHOLD_EXCEEDED');
    return {
      outcome: 'REJECTED',
      riskScore,
      dtiRatio,
      reasonCodes,
      policyVersion,
    };
  }

  reasonCodes.push('MARGINAL_PROFILE_MANUAL_REVIEW_REQUIRED');
  return {
    outcome: 'MANUAL_REVIEW',
    riskScore,
    dtiRatio,
    reasonCodes,
    approvedAmount: Math.round(app.requestedAmount * 0.8), // Recommended conditional limit
    policyVersion,
  };
}
