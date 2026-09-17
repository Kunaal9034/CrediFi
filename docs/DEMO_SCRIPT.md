# JusticeVault: Hackathon Demonstration Script & Walkthrough
**Tamper-Proof Digital Evidence & Chain-of-Custody Management System**

---

## 1. Demonstration Overview

This live demonstration proves the core invariant of **JusticeVault**:
1. **Raw evidence files are never stored on-chain** (preventing bloat and privacy leaks).
2. **The backend computes the authoritative SHA-256 cryptographic digest directly from the raw binary stream** (never trusting client-supplied hashes).
3. **The hash and all custody state transitions are anchored immutably to Polygon Amoy Testnet (`Chain ID: 80002`)**.
4. **Any modification—even a single byte or character in a multi-megabyte video—results in an instant `✗ FAILED / HASH MISMATCH` alert**.

---

## 2. Pre-Seeded Demonstration Personas

You can switch between any of these 5 personas instantly using the **"Demo Switcher" dropdown** in the top navigation bar, or log in with password `Password123!`:

| Persona | Name | Role | Email | Clearance / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Investigating Officer** | Det. Sarah Jenkins | `OFFICER` | `officer@justicevault.gov` | Creates cases, uploads digital evidence, initiates custody handoffs |
| **Forensic Specialist** | Dr. Evelyn Reed | `FORENSIC` | `forensic@justicevault.gov` | Accesses evidence, records forensic examination notes and toolkits |
| **Judge / Magistrate** | Judge Catherine Adams | `JUDGE` | `judge@justicevault.gov` | Performs independent judicial cryptographic hash verification |
| **Prosecutor** | DA David Miller | `PROSECUTOR` | `prosecutor@justicevault.gov` | Reviews custody trail and presents verified evidence in court |
| **Chief Administrator** | Marcus Vance | `ADMIN` | `admin@justicevault.gov` | Manages personnel, role permissions, and views system audit logs |

---

## 3. Step-by-Step Live Demo Scenario

### Scenario: `CASE-2026-001` (Metro Financial Center Vault Burglary)

#### Step 1: Officer Ingestion & On-Chain Anchoring
1. Open JusticeVault at `http://localhost:5173`.
2. Click **"Demo Switcher: Officer"** (or log in as `officer@justicevault.gov`).
3. In the Dashboard, click **"Register Evidence"** (or go to **Evidence Vault** -> **Register Evidence**).
4. Select Case: `CASE-2026-001: Metro Financial Center Vault Burglary`.
5. Upload the authentic file: `demo_assets/vault_cctv_cam2.mp4`.
6. Title: `Subterranean Vault CCTV Camera 02`. Category: `CCTV Video Footage`.
7. Click **"Register Evidence"**:
   - The backend streams the file, calculates the authoritative SHA-256 digest (`crypto.createHash`).
   - The file is stored off-chain and pinned with IPFS CID.
   - The hash is written to the `EvidenceChain.sol` contract on Polygon Amoy.
   - The UI outputs the confirmed on-chain transaction hash.

#### Step 2: Custodial Transfer to Cyber Forensics
1. Click into the new evidence item (e.g. `EV-001`).
2. Click **"Transfer Custody"**.
3. Select Recipient: `Dr. Evelyn Reed (Forensic Specialist)`.
4. Reason: `Transferred to Cyber Forensics Unit for biometric extraction`.
5. Submit: The transfer is recorded on-chain with from/to addresses and in the custody timeline.

#### Step 3: Forensic Examination
1. In the top bar, click **"Demo Switcher: Forensics"** (switches to Dr. Evelyn Reed).
2. Open evidence `EV-001`.
3. Click **"Download File"** (securely streamed from off-chain storage; automatically logs an `ACCESSED` custody event).
4. Click **"Record Analysis"**. Tool: `Autopsy Forensic Browser v4.21`. Findings: `Extracted suspect keyframe timestamps at 02:14:09`. Submit.

#### Step 4: Judicial Cryptographic Verification (Success Case: Hash Match)
1. Switch role to **Judge** (`judge@justicevault.gov`).
2. Navigate to **Verification Studio** (`/verify`) or open `EV-001` and click **"Verify Hash"**.
3. Drag & drop the authentic file `demo_assets/vault_cctv_cam2.mp4`.
4. Click **"Run Cryptographic Verification"**:
   - Recalculates SHA-256 from the file.
   - Fetches the immutable hash directly from Polygon Amoy.
   - Displays:
     ```
     ✓ VERIFIED — HASH MATCH
     Original On-Chain Digest: 8a4f...
     Recalculated Upload Digest: 8a4f...
     ```

#### Step 5: The Tamper Test (Failure Case: Hash Mismatch)
1. In the Verification Studio, click **"Verify Another File"**.
2. Drag & drop the altered file: `demo_assets/vault_cctv_cam2_TAMPERED.mp4` (where a single character in the file was altered).
3. Click **"Run Cryptographic Verification"**:
   - The backend recalculates the SHA-256 digest of the altered file.
   - It compares against the immutable on-chain hash.
   - Displays:
     ```
     ✗ FAILED — HASH MISMATCH
     CRITICAL ALERT: Recalculated hash does not match the immutable registered hash!
     File content has been modified or corrupted.
     ```
   - The evidence status is automatically flagged in the custody timeline and audit log!

#### Step 6: System Audit Trail (Admin View)
1. Switch to **Admin** (`admin@justicevault.gov`).
2. Navigate to **Audit Trail** (`/admin/audit`).
3. Show that every action—including user logins, file downloads, custody transfers, and both successful and failed verifications—has been recorded with timestamp, IP, actor, and on-chain transaction hashes.
