# DecisionTrace — Architecture Document

## 1. High-Level Architecture

DecisionTrace operates as a **modular monolith** with clear architectural boundaries between authentication, ingestion, hash chain ledgers, signed checkpoints, and verification.

```
┌─────────────────────────────────┐
│   External Financial System     │
│   (e.g., Loan Engine, Core)     │
└────────────────┬────────────────┘
                 │
                 │ POST /api/v1/events (API Key Auth)
                 ▼
┌────────────────────────────────────────────────────────┐
│               DecisionTrace REST API                   │
│                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────┐ │
│  │ Authenticate & Authorise│  │ Payload Validation   │ │
│  │ (API Key / JWT + Roles) │  │ (Zod Schema Engine)  │ │
│  └───────────┬─────────────┘  └──────────┬───────────┘ │
│              │                           │             │
│              ▼                           ▼             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Ingestion & Idempotency Engine                   │  │
│  │ - Deduplicates duplicate event submissions       │  │
│  │ - Atomic sequence assignment per case            │  │
│  └───────────────────────┬──────────────────────────┘  │
│                          │                             │
│       ┌──────────────────┼──────────────────┐          │
│       ▼                  ▼                  ▼          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Case Summary │  │ SHA-256 Hash │  │ Evidence     │  │
│  │ Projection   │  │ Chain Ledger │  │ Snapshot     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
│         │          ┌──────▼───────┐         │          │
│         │          │ Signed HMAC  │         │          │
│         │          │ Checkpoint   │         │          │
│         │          └──────┬───────┘         │          │
│         ▼                 ▼                 ▼          │
│  ┌──────────────────────────────────────────────────┐  │
│  │                    MongoDB                       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Component Descriptions

### Ingestion Service
- **Endpoint**: `POST /api/v1/events`
- **Idempotency**: Checked against `{ tenantId, sourceSystem, eventId }`. Identical payloads return the existing event reference (`idempotentReplay: true`). Mismatched payloads with the same ID return `409 Conflict`.
- **Atomicity**: Uses MongoDB transaction sessions to atomically allocate the next sequence number and write to the ledger and case projection.

### Hash Chain Ledger
- **Algorithm**: Canonical JSON serialisation + SHA-256
- **Genesis**: Event #1 has `previousHash: "GENESIS"`
- **Linkage**: Event #N has `previousHash: Event[N-1].eventHash`
- **Tamper Evidence**: Any modification to payload, sequence, timestamps, or previous hash breaks the link or mismatches the calculated hash.

### Checkpoint Service
- **Mechanism**: Every configurable interval of events (default: 10), an HMAC-SHA-256 signature is calculated over `(tenantId, caseId, sequence, eventHash, createdAt, keyId)`.
- **Purpose**: Detects event deletion or truncation up to the checkpoint sequence.

### Verification Engine
- Recomputes every event hash in sequence order from immutable fields.
- Checks sequence continuity (detects dropped events).
- Compares calculated hashes with stored hashes.
- Verifies previousHash chain integrity.
- Validates checkpoint signatures against the secret.
- Compares checkpoint event hashes against the ledger events at those sequences.

---

## 3. Data Flow

1. An external financial engine calls `POST /api/v1/events` with an `X-API-Key`.
2. The API key is verified via its SHA-256 hash in `api_keys`.
3. Zod validates the structure, payload size (≤64KB), and event type.
4. If a decision event occurs, an immutable evidence snapshot is frozen in `snapshots`.
5. The next integer sequence is assigned atomically.
6. The event is linked to the previous event hash, SHA-256 computed, and persisted to `ledger_events`.
7. If a checkpoint interval is hit, an HMAC-signed checkpoint is recorded in `checkpoints`.
8. The case projection in `cases` is updated for sub-millisecond query performance.
9. Staff auditors access the React dashboard, view the timeline, and trigger `POST /api/v1/cases/:caseId/verify` to verify integrity on demand.
