# DecisionTrace

> **A flight recorder for financial decisions** — decision traceability and audit platform for financial institutions.

**Project:** Visionet TechThon 2026 — Round 2  
**Team:** CodeGenesis  
**Status:** Prototype / Hackathon Build

---

## What is DecisionTrace?

DecisionTrace is a web dashboard and API that captures the evidence, rules, model metadata, decision outcome, and human review actions associated with a financial decision. It provides:

- **Case timeline** — chronological event history for each decision
- **Tamper-evident audit trail** — per-case SHA-256 hash chains with HMAC-signed checkpoints
- **Integrity verification** — detect modifications, deletions, and broken links
- **Evidence snapshots** — freeze decision inputs and rule/model versions
- **Role-based access** — ADMIN, AUDITOR, REVIEWER, DISPUTE_HANDLER
- **API-first** — event ingestion via authenticated API keys

> ⚠ **This is a prototype.** It does not claim production-grade security, bank certification, or regulatory compliance. See [Known Limitations](docs/known-limitations.md).

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** ≥ 6.0 (local or Atlas)
- **npm** ≥ 9

### Setup

```bash
# 1. Clone and install
git clone <repository-url>
cd decisiontrace

# 2. Install API dependencies
cd apps/api
npm install

# 3. Configure environment
cp ../../.env.example ../../.env
# Edit .env — set MONGODB_URI, JWT_SECRET, CHECKPOINT_HMAC_SECRET

# 4. Seed demo data
npx ts-node ../../scripts/seed-demo.ts

# 5. Start API server
npm run dev
# → http://localhost:5000/api/v1/health

# 6. Send sample events (use the API key from seed output)
npx ts-node ../../scripts/send-sample-events.ts <YOUR_API_KEY>

# 7. Start frontend (in a new terminal)
cd ../web
npm install
npm run dev
# → http://localhost:5173
```

### Demo Credentials

| Role    | Email                   | Password     |
|---------|-------------------------|--------------|
| Admin   | admin@demo-bank.com     | Admin@123    |
| Auditor | auditor@demo-bank.com   | Auditor@123  |

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────────────┐
│  External Systems   │────▶│  DecisionTrace REST API          │
│  (API Key Auth)     │     │  ├─ Event Ingestion              │
└─────────────────────┘     │  ├─ Case Management              │
                            │  ├─ Hash Chain / Ledger           │
┌─────────────────────┐     │  ├─ Checkpoint Signing            │
│  Staff Dashboard    │────▶│  ├─ Verification Service          │
│  (JWT Auth)         │     │  ├─ Auth & RBAC                   │
└─────────────────────┘     │  └─ Audit Access Logging          │
                            └──────────────┬───────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │   MongoDB    │
                                    └─────────────┘
```

---

## API Endpoints

| Method | Endpoint                          | Auth     | Description                    |
|--------|-----------------------------------|----------|--------------------------------|
| GET    | `/api/v1/health`                  | Public   | Health check                   |
| POST   | `/api/v1/auth/login`              | Public   | Staff login                    |
| GET    | `/api/v1/auth/me`                 | JWT      | Current user info              |
| POST   | `/api/v1/auth/api-keys`           | JWT/ADMIN| Create API key                 |
| GET    | `/api/v1/auth/api-keys`           | JWT/ADMIN| List API key metadata          |
| DELETE | `/api/v1/auth/api-keys/:keyId`    | JWT/ADMIN| Revoke API key                 |
| POST   | `/api/v1/events`                  | API Key  | Ingest financial event         |
| GET    | `/api/v1/cases`                   | JWT      | List cases (filtered)          |
| GET    | `/api/v1/cases/:caseId`           | JWT      | Case detail                    |
| GET    | `/api/v1/cases/:caseId/events`    | JWT      | Case event timeline            |
| POST   | `/api/v1/cases/:caseId/verify`    | JWT/AUDIT| Verify case integrity          |
| GET    | `/api/v1/cases/:caseId/checkpoints` | JWT/AUDIT | List checkpoints            |

---

## Testing

```bash
cd apps/api
npm test
```

Tests use **mongodb-memory-server** — no external MongoDB needed for tests.

---

## Feature Status

| Feature            | Status       | Evidence                     |
|--------------------|-------------|------------------------------|
| Event ingestion    | ✅ Done     | API + unit/integration tests |
| Hash chain         | ✅ Done     | Canonical hash + unit tests  |
| Checkpoints        | ✅ Done     | HMAC signing + verification  |
| Verification       | ✅ Done     | API + tamper detection tests |
| Authentication     | ✅ Done     | JWT + API keys + RBAC        |
| Dashboard          | ✅ Done     | React + Vite + Tailwind UI   |
| Replay             | ✅ Done     | Snapshot + versioned logic   |
| ML + SHAP          | ✅ Done     | FastAPI + LogisticRegression |
| PDF report         | ✅ Done     | HTML / PDF Printable Export  |

---

## Technology Stack

| Layer        | Technology                | Reason                        |
|-------------|---------------------------|-------------------------------|
| Frontend    | React + TypeScript + Vite | Team familiarity              |
| Styling     | Tailwind CSS              | Fast, consistent UI           |
| Backend     | Node.js + Express + TS    | Team's strongest stack        |
| Database    | MongoDB + Mongoose        | Flexible event documents      |
| Validation  | Zod                       | Runtime payload validation    |
| Auth        | JWT + bcrypt              | Prototype internal login      |
| Hashing     | SHA-256 (Node crypto)     | Event hash chain              |
| Signing     | HMAC-SHA-256              | Prototype checkpoint signing  |
| Testing     | Vitest + Supertest        | Unit and API tests            |

---

## Important Caveats

1. A hash chain is tamper-**evident**, not magically immutable.
2. HMAC checkpoints are only as trustworthy as protection of the HMAC key.
3. This system does **not** claim RBI, DPDP, or any regulatory compliance.
4. All data is synthetic. No real customer information is used.
5. See [docs/security-and-privacy.md](docs/security-and-privacy.md) for full details.

---

## License

MIT — Hackathon project.
