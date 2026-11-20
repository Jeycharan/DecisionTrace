# DecisionTrace — Threat Model & Residual Risks

## 1. Threat Analysis

| Threat | Attack Vector | DecisionTrace Control | Residual Risk |
|---|---|---|---|
| **Payload Tampering** | Rogue DB administrator alters decision from `REJECTED` to `APPROVED`. | Canonical JSON + SHA-256 hash chain detects mismatch on verification. | If verification is never run, tampering is not noticed until an audit. |
| **Event Dropping / Deletion** | Malicious insider deletes an incriminating `DECISION_OVERRIDDEN` event. | Sequence continuity check (`sequence === i + 1`) and signed checkpoints detect missing sequence. | Uncheckpointed events at the very tip of the chain could be deleted if no checkpoint covers them yet. |
| **Replay / Duplicate Ingestion** | Network retry sends duplicate decision event. | Unique index on `{ tenantId, sourceSystem, eventId }` + payload hash check guarantees idempotency. | None. |
| **Unauthorized Verification** | Non-auditor tries to run verification or forge checkpoints. | RBAC middleware restricts verification to `ADMIN` and `AUDITOR` roles. Checkpoint creation is backend-only. | Compromised admin credentials. |
| **Key Theft** | Attacker extracts API key from network. | API keys stored as SHA-256 hashes. HTTPS recommended in production. Revocation API instantly disables keys. | Key valid until revoked if network is unencrypted in dev. |

---

## 2. Verification Guarantees

1. **Chain Consistency**: Verifies that every event mathematically links to its predecessor from `GENESIS`.
2. **Anchor Verification**: Validates HMAC signature on checkpoints and matches the sealed hash with the corresponding ledger event.
3. **Diagnostic Reporting**: Pinpoints the exact sequence number, event ID, and failure reason when tampering occurs.
