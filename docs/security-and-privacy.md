# DecisionTrace — Security and Privacy Guide

## 1. Authentication & Role-Based Access Control (RBAC)

DecisionTrace defines four internal prototype roles:

| Role | Permissions |
|---|---|
| `ADMIN` | Manage API keys, view all cases, verify integrity, view access logs |
| `AUDITOR` | View all permitted cases, inspect chronological timelines, trigger verification |
| `REVIEWER` | View assigned cases, review evidence snapshots, record reviews |
| `DISPUTE_HANDLER` | View customer-safe case summaries without sensitive internal model factors |

- **Password Hashing**: Passwords are hashed using bcrypt with salt factor 10.
- **Tokens**: JWT access tokens are signed with HMAC-SHA-256 (`JWT_SECRET`) and carry a configurable expiry (default: 1 hour).
- **API Keys**: External keys are generated with high-entropy cryptographic random bytes (`dtk_<prefix>_<secret>`). The raw key is returned **only once** upon creation. Only the SHA-256 hash is persisted.

---

## 2. Multi-Tenant Scoping

- Every query across `cases`, `ledger_events`, `snapshots`, `checkpoints`, and `api_keys` strictly filters on `tenantId`.
- External API keys are permanently bound to a single `tenantId` and `sourceSystem`.
- The API validates that event `tenantId` in the body strictly matches the authenticated API key's tenant.

---

## 3. Data Minimisation & Privacy (DPDP / GDPR Alignment)

- **No Raw Customer PII in Permanent Ledger**: Decisions reference a pseudonymous `subjectRef` (e.g. `subj_demo_1001`) rather than customer names, national identity numbers, or phone numbers.
- **Payload Size Limits**: Payloads are capped at 64KB to prevent accidental bulk storage of unstructured documents.
- **Separation of Concerns**: Evidence snapshots capture only decision-relevant facts needed to explain or replay the decision.

---

## 4. Checkpoint Limitations (Honest Prototype Disclosure)

- In this prototype, checkpoints are signed using HMAC-SHA-256 with a local shared secret (`CHECKPOINT_HMAC_SECRET`).
- **Trust Boundary Caveat**: If an attacker gains full root access to both the database and the server's environment secrets, they could theoretically recalculate hashes and forge signatures.
- **Production Path**: In a production enterprise deployment, checkpoint signing must be delegated to a Hardware Security Module (HSM) or Cloud KMS (e.g. AWS KMS, GCP Cloud KMS, Azure Key Vault) with asymmetric private keys that never leave secure hardware, and checkpoints should be anchored to an immutable write-once store.
