# DecisionTrace — Demo Script for Hackathon Presentation

Follow this exact walkthrough during the live jury evaluation:

---

### Step 1: System Startup
1. Ensure API and MongoDB are running:
   ```bash
   cd apps/api && npm run dev
   # API running at http://localhost:5000
   ```
2. Start the React Frontend:
   ```bash
   cd apps/web && npm run dev
   # Dashboard running at http://localhost:5173
   ```
3. Open `http://localhost:5173` in the browser.

---

### Step 2: Authentication Walkthrough
1. On the login screen, click the **Auditor** quick-credential pill (`auditor@demo-bank.com` / `Auditor@123`).
2. Click **Sign in to Dashboard**.
3. Point out the clear enterprise layout: role badge, tenant scope, decision statistics, and recent activity.

---

### Step 3: Ingest a Live Event Sequence
1. Open a terminal and run the sample events script:
   ```bash
   cd scripts && npx ts-node send-sample-events.ts <API_KEY>
   ```
2. Show the CLI output confirming:
   - `CASE_CREATED` (seq 1)
   - `EVIDENCE_CAPTURED` (seq 2, snapshot generated)
   - `DECISION_MADE` (seq 3, rules/model versioned)
   - `REVIEW_REQUESTED` (seq 4)
   - `DECISION_OVERRIDDEN` (seq 5, human override reason, checkpoint generated)
   - `APPROVAL_CONFIRMED` (seq 6)

---

### Step 4: Inspect the Case Timeline
1. In the Dashboard, click into `loan_case_1001`.
2. Show the case header: Pseudonymous `subjectRef`, risk score (82/100), latest outcome.
3. Walk down the chronological timeline:
   - Notice the exact timestamps (Occurred vs Recorded).
   - Point out the logic versioning (`loan-policy@1.0.0` and `credit-risk-demo@model_v1`).
   - Show the Human Override card highlighting the transition from `MANUAL_REVIEW` to `APPROVED` with justification.
   - Show the SHA-256 Hash Chain Box for each event, with truncated hashes, copy buttons, and `previousHash` links.

---

### Step 5: Run Cryptographic Verification (Intact State)
1. Click the **Verify Case Integrity** button.
2. Show the instant verification result:
   - Status: **Verified Against Signed Checkpoint Anchor**
   - 6 events checked, chain consistent, checkpoint verified.
   - Show the Checkpoint sequence badge and uncovered events counter.

---

### Step 6: Live Tampering Demonstration (The "Aha!" Moment)
1. In the terminal, run the development tamper script to simulate a rogue database change:
   ```bash
   npx ts-node scripts/tamper-demo.ts --case=loan_case_1001 --tamper-payload --confirm
   ```
2. Explain to the judges:
   *"A rogue database operator modified the decision event in MongoDB from MANUAL_REVIEW to APPROVED and changed the risk score."*
3. Return to the browser and click **Verify Case Integrity** again.
4. **Result**: The dashboard immediately turns **RED** with:
   - **Integrity Verification FAILED — Tampering Detected**
   - Sequence: **#3**
   - Reason: **`EVENT_HASH_MISMATCH`**
   - Explains that the recalculated SHA-256 hash of the stored data diverges from the immutable event hash.

---

### Step 7: Summary & Conclusion
1. Explain that DecisionTrace turns black-box decision systems into verifiable flight recorders.
2. Highlight honest limitations: Tamper-evident ledger, synthetic models, prototype HMAC checkpoints.
