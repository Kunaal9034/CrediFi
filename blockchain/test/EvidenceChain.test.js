const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EvidenceChain Smart Contract (Phase 3 Test Suite)", function () {
  let evidenceChain;
  let owner, operator, officer, forensic, judge, unauthorized;

  // Sample test parameters
  const sampleEvidenceId = "EV-2026-001";
  const sampleCaseId = "CASE-2026-001";
  const sampleSha256 = "0x8a4f89d3637e7d6b38c26359f81f1e9488fffa962e22c710ec427383a1a9e701";
  const sampleStorageIdentifier = "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

  beforeEach(async function () {
    [owner, operator, officer, forensic, judge, unauthorized] = await ethers.getSigners();

    const EvidenceChainFactory = await ethers.getContractFactory("EvidenceChain");
    evidenceChain = await EvidenceChainFactory.deploy();
    await evidenceChain.waitForDeployment();

    // Authorize operator
    await evidenceChain.setOperator(operator.address, true);
  });

  // 1. Contract deployment
  it("1. Contract deployment: should deploy with valid address and set deployer as owner", async function () {
    const address = await evidenceChain.getAddress();
    expect(address).to.be.properAddress;
    expect(await evidenceChain.owner()).to.equal(owner.address);
  });

  // 2. Owner authorization
  it("2. Owner authorization: should initialize owner as an authorized operator", async function () {
    expect(await evidenceChain.authorizedOperators(owner.address)).to.be.true;
  });

  // 3. Authorized operator authorization
  it("3. Authorized operator authorization: should allow owner to grant and revoke operator status", async function () {
    expect(await evidenceChain.authorizedOperators(operator.address)).to.be.true;

    // Revoke operator
    await evidenceChain.setOperator(operator.address, false);
    expect(await evidenceChain.authorizedOperators(operator.address)).to.be.false;

    // Re-grant operator
    await evidenceChain.setOperator(operator.address, true);
    expect(await evidenceChain.authorizedOperators(operator.address)).to.be.true;
  });

  // 4. Unauthorized operator rejection
  it("4. Unauthorized operator rejection: should revert when non-owner sets operator or unauthorized user registers evidence", async function () {
    // Non-owner cannot manage operators
    await expect(
      evidenceChain.connect(unauthorized).setOperator(unauthorized.address, true)
    ).to.be.revertedWithCustomError(evidenceChain, "OwnableUnauthorizedAccount");

    // Unauthorized user cannot register evidence
    await expect(
      evidenceChain
        .connect(unauthorized)
        .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address)
    ).to.be.revertedWith("EvidenceChain: Caller is not an authorized operator");

    // Unauthorized user cannot record custody event
    await expect(
      evidenceChain
        .connect(unauthorized)
        .recordCustodyEvent(sampleEvidenceId, 1, unauthorized.address, ethers.ZeroAddress, unauthorized.address, "Unauthorized access")
    ).to.be.revertedWith("EvidenceChain: Caller is not an authorized operator");
  });

  // 5. Valid evidence registration
  it("5. Valid evidence registration: should successfully register evidence via authorized operator", async function () {
    const tx = await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    expect(tx).to.be.ok;
    const record = await evidenceChain.getEvidence(sampleEvidenceId);
    expect(record.exists).to.be.true;
    expect(record.id).to.equal(sampleEvidenceId);
    expect(record.caseId).to.equal(sampleCaseId);
    expect(record.sha256Hash).to.equal(sampleSha256);
    expect(record.storageIdentifier).to.equal(sampleStorageIdentifier);
    expect(record.registeredBy).to.equal(officer.address);
  });

  // 6. Duplicate evidenceId rejection
  it("6. Duplicate evidenceId rejection: should revert when registering the same evidenceId twice", async function () {
    await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    const differentHash = "0x9b5f89d3637e7d6b38c26359f81f1e9488fffa962e22c710ec427383a1a9e702";
    await expect(
      evidenceChain
        .connect(operator)
        .registerEvidence(sampleEvidenceId, "CASE-2026-002", differentHash, sampleStorageIdentifier, officer.address)
    ).to.be.revertedWith("EvidenceChain: Evidence ID already registered");
  });

  // 7. Zero hash rejection
  it("7. Zero hash rejection: should revert if sha256 is zero hash or required identifiers are empty", async function () {
    // Zero hash
    await expect(
      evidenceChain
        .connect(operator)
        .registerEvidence("EV-ZERO", sampleCaseId, ethers.ZeroHash, sampleStorageIdentifier, officer.address)
    ).to.be.revertedWith("EvidenceChain: Invalid zero hash");

    // Empty evidenceId
    await expect(
      evidenceChain
        .connect(operator)
        .registerEvidence("", sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address)
    ).to.be.revertedWith("EvidenceChain: Empty evidenceId");

    // Empty caseId
    await expect(
      evidenceChain
        .connect(operator)
        .registerEvidence("EV-EMPTY-CASE", "", sampleSha256, sampleStorageIdentifier, officer.address)
    ).to.be.revertedWith("EvidenceChain: Empty caseId");
  });

  // 8. Duplicate SHA-256 hash under a DIFFERENT evidenceId succeeds
  it("8. Duplicate SHA-256 hash under a DIFFERENT evidenceId succeeds (Cross-Case Evidence Policy)", async function () {
    const evidenceId1 = "EV-001";
    const caseId1 = "CASE-001";
    const sharedHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const storageId1 = "local://store/video1.mp4";

    const evidenceId2 = "EV-002";
    const caseId2 = "CASE-002";
    const storageId2 = "local://store/video1_copy.mp4";

    // First registration under CASE-001 / EV-001
    await evidenceChain
      .connect(operator)
      .registerEvidence(evidenceId1, caseId1, sharedHash, storageId1, officer.address);

    // Second registration of identical hash under CASE-002 / EV-002 MUST SUCCEED
    await expect(
      evidenceChain
        .connect(operator)
        .registerEvidence(evidenceId2, caseId2, sharedHash, storageId2, officer.address)
    ).to.not.be.reverted;

    // Both evidence records exist and retain their respective metadata
    const record1 = await evidenceChain.getEvidence(evidenceId1);
    const record2 = await evidenceChain.getEvidence(evidenceId2);

    expect(record1.id).to.equal(evidenceId1);
    expect(record1.caseId).to.equal(caseId1);
    expect(record1.sha256Hash).to.equal(sharedHash);

    expect(record2.id).to.equal(evidenceId2);
    expect(record2.caseId).to.equal(caseId2);
    expect(record2.sha256Hash).to.equal(sharedHash);
  });

  // 9. EvidenceRegistered event
  it("9. EvidenceRegistered event: should emit EvidenceRegistered with correct indexed arguments", async function () {
    const tx = await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    const block = await ethers.provider.getBlock("latest");

    await expect(tx)
      .to.emit(evidenceChain, "EvidenceRegistered")
      .withArgs(
        sampleEvidenceId,
        sampleCaseId,
        sampleSha256,
        sampleStorageIdentifier,
        officer.address,
        block.timestamp
      );
  });

  // 10. CustodyEventLogged event
  it("10. CustodyEventLogged event: should emit CustodyEventLogged on registration and state transitions", async function () {
    // Initial registration emits CustodyEventLogged (REGISTERED)
    const regTx = await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    const block1 = await ethers.provider.getBlock("latest");
    await expect(regTx)
      .to.emit(evidenceChain, "CustodyEventLogged")
      .withArgs(
        sampleEvidenceId,
        0, // CustodyAction.REGISTERED
        officer.address,
        ethers.ZeroAddress,
        officer.address,
        block1.timestamp,
        "Initial Evidence Registration"
      );

    // Subsequent transfer emits CustodyEventLogged (TRANSFERRED)
    const transferTx = await evidenceChain
      .connect(operator)
      .recordCustodyEvent(
        sampleEvidenceId,
        2, // CustodyAction.TRANSFERRED
        officer.address,
        officer.address,
        forensic.address,
        "Transferred to forensics laboratory"
      );

    const block2 = await ethers.provider.getBlock("latest");
    await expect(transferTx)
      .to.emit(evidenceChain, "CustodyEventLogged")
      .withArgs(
        sampleEvidenceId,
        2, // TRANSFERRED
        officer.address,
        officer.address,
        forensic.address,
        block2.timestamp,
        "Transferred to forensics laboratory"
      );
  });

  // 11. Custody history
  it("11. Custody history: should track chronological custody records accessible by index", async function () {
    await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    // Custody transition 1: TRANSFERRED
    await evidenceChain
      .connect(operator)
      .recordCustodyEvent(sampleEvidenceId, 2, officer.address, officer.address, forensic.address, "Transferred to Forensics");

    // Custody transition 2: ANALYZED
    await evidenceChain
      .connect(operator)
      .recordCustodyEvent(sampleEvidenceId, 3, forensic.address, ethers.ZeroAddress, forensic.address, "Forensic Autopsy Performed");

    // Custody transition 3: VERIFIED
    await evidenceChain
      .connect(operator)
      .recordCustodyEvent(sampleEvidenceId, 4, judge.address, ethers.ZeroAddress, ethers.ZeroAddress, "Judicial Hash Match Verified");

    const count = await evidenceChain.getCustodyHistoryCount(sampleEvidenceId);
    expect(count).to.equal(4n);

    // Verify record 0 (REGISTERED)
    const rec0 = await evidenceChain.getCustodyRecord(sampleEvidenceId, 0);
    expect(rec0.action).to.equal(0);
    expect(rec0.actor).to.equal(officer.address);

    // Verify record 1 (TRANSFERRED)
    const rec1 = await evidenceChain.getCustodyRecord(sampleEvidenceId, 1);
    expect(rec1.action).to.equal(2);
    expect(rec1.actor).to.equal(officer.address);
    expect(rec1.toUser).to.equal(forensic.address);

    // Verify record 2 (ANALYZED)
    const rec2 = await evidenceChain.getCustodyRecord(sampleEvidenceId, 2);
    expect(rec2.action).to.equal(3);
    expect(rec2.actor).to.equal(forensic.address);

    // Verify record 3 (VERIFIED)
    const rec3 = await evidenceChain.getCustodyRecord(sampleEvidenceId, 3);
    expect(rec3.action).to.equal(4);
    expect(rec3.actor).to.equal(judge.address);

    // Verify out of bounds index reverts
    await expect(
      evidenceChain.getCustodyRecord(sampleEvidenceId, 99)
    ).to.be.revertedWith("EvidenceChain: Index out of bounds");
  });

  // 12. getEvidence()
  it("12. getEvidence(): should return complete and correct evidence record and revert for nonexistent", async function () {
    await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    const record = await evidenceChain.getEvidence(sampleEvidenceId);
    expect(record.id).to.equal(sampleEvidenceId);
    expect(record.caseId).to.equal(sampleCaseId);
    expect(record.sha256Hash).to.equal(sampleSha256);
    expect(record.storageIdentifier).to.equal(sampleStorageIdentifier);
    expect(record.registeredBy).to.equal(officer.address);
    expect(record.registeredAt).to.be.gt(0);
    expect(record.exists).to.be.true;

    // Nonexistent evidenceId reverts
    await expect(
      evidenceChain.getEvidence("NON-EXISTENT-ID")
    ).to.be.revertedWith("EvidenceChain: Evidence does not exist");
  });

  // 13. verifyEvidenceHash() returns true for matching hash
  it("13. verifyEvidenceHash() returns true for matching hash: should confirm cryptographic match", async function () {
    await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    const isMatch = await evidenceChain.verifyEvidenceHash(sampleEvidenceId, sampleSha256);
    expect(isMatch).to.be.true;
  });

  // 14. verifyEvidenceHash() returns false for mismatching hash
  it("14. verifyEvidenceHash() returns false for mismatching hash: should detect tampered / differing digest", async function () {
    await evidenceChain
      .connect(operator)
      .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256, sampleStorageIdentifier, officer.address);

    const tamperedHash = "0x000000000000000000000000000000000000000000000000000000000000dead";
    const isMatch = await evidenceChain.verifyEvidenceHash(sampleEvidenceId, tamperedHash);
    expect(isMatch).to.be.false;

    // Nonexistent evidence reverts
    await expect(
      evidenceChain.verifyEvidenceHash("NON-EXISTENT", sampleSha256)
    ).to.be.revertedWith("EvidenceChain: Evidence does not exist");
  });
});
