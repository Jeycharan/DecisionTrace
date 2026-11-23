/**
 * MiniBank Configuration
 * Links to local DecisionTrace platform instance.
 */
export const config = {
  port: parseInt(process.env.MINIBANK_PORT || '3001', 10),
  decisionTraceApiUrl: process.env.DECISIONTRACE_API_URL || 'http://localhost:5000/api/v1',
  decisionTraceApiKey:
    process.env.DECISIONTRACE_API_KEY ||
    'dtk_ac1fc649_4e076b9b1853714d46ee04634b9071b70b93e2f57b9d664a920354aafc763ae3',
  decisionTraceUiUrl: process.env.DECISIONTRACE_UI_URL || 'http://localhost:3000',
  tenantId: 'demo-bank',
  sourceSystem: 'minibank-core-origination',
};
