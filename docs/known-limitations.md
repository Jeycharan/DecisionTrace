# DecisionTrace — Known Limitations & Prototype Boundaries

In compliance with our engineering principles and hackathon disclosure guidelines, this document explicitly outlines the scope, assumptions, and limitations of this build.

---

## 1. What is Implemented & Tested
- Full REST API with TypeScript, Express, and MongoDB.
- Canonical JSON serialisation and deterministic SHA-256 event hash chaining.
- Monotonically increasing atomic sequence allocation per case.
- HMAC-SHA-256 signed checkpoints with configurable interval.
- Verification engine detecting payload edits, sequence gaps, and broken hash links.
- Multi-tenant architecture with tenant-scoped indexing and query filtering.
- API key authentication with SHA-256 hashing and instant revocation.
- JWT staff authentication with bcrypt password hashing and RBAC.
- Modern React + TypeScript + Vite + Tailwind audit dashboard.

---

## 2. Prototype Boundaries & Disclaimers
1. **Not a Blockchain**: DecisionTrace does not use proof-of-work, consensus mechanisms, or distributed peer-to-peer nodes. It is an enterprise audit flight recorder using cryptographic hash chaining.
2. **HMAC Checkpoint Trust Boundary**: Checkpoints in this prototype are signed using an HMAC secret. If an attacker has full database read/write AND server environment access, they could theoretically recalculate hashes. Production deployments should use Cloud KMS/HSM asymmetric key pairs.
3. **Integrity of Bytes vs Truth of Input**: DecisionTrace mathematically proves that stored decision records have not been altered since ingestion. It cannot independently verify whether the external financial engine supplied truthful external credit bureau data.
4. **Synthetic Data**: All demo cases and subject references are synthetic test data. No real customer or banking information is collected.
5. **Regulatory Compliance**: DecisionTrace is an engineering prototype designed to assist compliance workflows; it does not constitute legal certification under RBI, DPDP, or any other financial regulation.
