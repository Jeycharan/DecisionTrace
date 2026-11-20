# DecisionTrace — Event Contract Specification

All external systems submitting financial events to DecisionTrace communicate via `POST /api/v1/events` using HTTP/JSON.

## 1. Authentication
External sending systems authenticate using an API key passed in the `X-API-Key` header:
```http
X-API-Key: dtk_prefix_secret
```

---

## 2. Event Payload Schema

```json
{
  "eventId": "evt_demo_0001",
  "schemaVersion": 1,
  "tenantId": "demo-bank",
  "caseId": "loan_case_1001",
  "sourceSystem": "demo-loan-engine",
  "eventType": "DECISION_MADE",
  "occurredAt": "2026-11-20T10:30:00.000Z",
  "caseType": "LOAN",
  "subjectRef": "subj_demo_1001",
  "payload": {
    "application": {
      "requestedAmount": 500000,
      "monthlyIncome": 45000,
      "existingLoanAmount": 200000,
      "accountAgeMonths": 8
    },
    "decision": {
      "outcome": "MANUAL_REVIEW",
      "riskScore": 82,
      "currency": "INR"
    },
    "reasonCodes": [
      "SHORT_ACCOUNT_HISTORY",
      "HIGH_EXISTING_OBLIGATION"
    ],
    "rules": {
      "rulesetId": "loan-policy",
      "rulesetVersion": "1.0.0"
    },
    "model": {
      "modelId": "credit-risk-demo",
      "modelVersion": "model_v1"
    }
  }
}
```

---

## 3. Allowed Field Enums

### `eventType`
| Event Type | Typical Trigger |
|---|---|
| `CASE_CREATED` | Initial loan application or decision case opened |
| `EVIDENCE_CAPTURED` | Bureau score, income statement, or KYC verification frozen |
| `DECISION_MADE` | Automated decision engine produces outcome & risk score |
| `REVIEW_REQUESTED` | Manual review requested due to high risk or rule trigger |
| `DECISION_OVERRIDDEN` | Credit officer overrides automated outcome with justification |
| `APPROVAL_CONFIRMED` | Final disbursement or terms confirmed |
| `CASE_CLOSED` | File closed or rejected |

### `caseType`
`LOAN` | `PAYMENT` | `INSURANCE` | `KYC` | `OTHER`

---

## 4. Idempotency Behavior

- When a request with `{ tenantId, sourceSystem, eventId }` is received for the first time:
  - Return `201 Created` with sequence, eventHash, and `idempotentReplay: false`.
- When the identical payload is sent with the same `eventId`:
  - Return `200 OK` with the existing event record and `idempotentReplay: true`.
- When the same `eventId` is sent with a **different** payload:
  - Return `409 Conflict` (Code: `CONFLICT`). Never accept changed data under an existing ID.
