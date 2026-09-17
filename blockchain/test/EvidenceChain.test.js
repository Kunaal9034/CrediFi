const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EvidenceChain Smart Contract", function () {
  let evidenceChain;
  let owner, operator, officer, forensic, judge, unauthorized;

  // Sample test data
  const sampleEvidenceId = "EV-2026-001";
  const sampleCaseId = "CASE-2026-001";
  const sampleSha256Hex = "0x8a4f89d3637e7d6b38c26359f81f1e9488fffa962e22c710ec427383a1a9e701";
  const sampleIpfsCid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

  beforeEach(async function () {
    [owner, operator, officer, forensic, judge, unauthorized] = await ethers.getSigners();

    const EvidenceChainFactory = await ethers.getContractFactory("EvidenceChain");
    evidenceChain = await EvidenceChainFactory.deploy();
    await evidenceChain.waitForDeployment();

    // Authorize operator
    await evidenceChain.setOperator(operator.address, true);
  });

  describe("Deployment & Authorization", function () {
    it("should set deployer as owner and initial authorized operator", async function () {
      expect(await evidenceChain.owner()).to.equal(owner.address);
      expect(await evidenceChain.authorizedOperators(owner.address)).to.be.true;
    });

    it("should allow owner to authorize and revoke operators", async function () {
      expect(await evidenceChain.authorizedOperators(operator.address)).to.be.true;

      await evidenceChain.setOperator(operator.address, false);
      expect(await evidenceChain.authorizedOperators(operator.address)).to.be.false;
    });

    it("should reject operator registration from non-owner", async function () {
      await expect(
        evidenceChain.connect(unauthorized).setOperator(unauthorized.address, true)
      ).to.be.revertedWithCustomError(evidenceChain, "OwnableUnauthorizedAccount");
    });
  });

  describe("Evidence Registration", function () {
    it("should allow an authorized operator to register digital evidence", async function () {
      const tx = await evidenceChain
        .connect(operator)
        .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address);

      await expect(tx)
        .to.emit(evidenceChain, "EvidenceRegistered")
        .withArgs(
          sampleEvidenceId,
          sampleCaseId,
          sampleSha256Hex,
          sampleIpfsCid,
          officer.address,
          await ethers.provider.getBlock("latest").then((b) => b.timestamp)
        );

      const record = await evidenceChain.getEvidence(sampleEvidenceId);
      expect(record.id).to.equal(sampleEvidenceId);
      expect(record.caseId).to.equal(sampleCaseId);
      expect(record.sha256Hash).to.equal(sampleSha256Hex);
      expect(record.ipfsCid).to.equal(sampleIpfsCid);
      expect(record.registeredBy).to.equal(officer.address);
      expect(record.exists).to.be.true;
    });

    it("should automatically log initial REGISTERED custody event upon registration", async function () {
      await evidenceChain
        .connect(operator)
        .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address);

      const count = await evidenceChain.getCustodyHistoryCount(sampleEvidenceId);
      expect(count).to.equal(1n);

      const custodyRec = await evidenceChain.getCustodyRecord(sampleEvidenceId, 0);
      expect(custodyRec.action).to.equal(0); // CustodyAction.REGISTERED
      expect(custodyRec.actor).to.equal(officer.address);
      expect(custodyRec.reason).to.equal("Initial Evidence Registration");
    });

    it("should reject duplicate evidence ID registration", async function () {
      await evidenceChain
        .connect(operator)
        .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address);

      const differentHash = "0x9b5f89d3637e7d6b38c26359f81f1e9488fffa962e22c710ec427383a1a9e702";
      await expect(
        evidenceChain
          .connect(operator)
          .registerEvidence(sampleEvidenceId, sampleCaseId, differentHash, sampleIpfsCid, officer.address)
      ).to.be.revertedWith("EvidenceChain: Evidence ID already registered");
    });

    it("should reject duplicate SHA-256 hash registration", async function () {
      await evidenceChain
        .connect(operator)
        .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address);

      const differentEvidenceId = "EV-2026-002";
      await expect(
        evidenceChain
          .connect(operator)
          .registerEvidence(differentEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address)
      ).to.be.revertedWith("EvidenceChain: SHA-256 hash already registered on-chain");
    });

    it("should reject registration with empty evidenceId or zero hash", async function () {
      await expect(
        evidenceChain.connect(operator).registerEvidence("", sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address)
      ).to.be.revertedWith("EvidenceChain: Empty evidenceId");

      await expect(
        evidenceChain.connect(operator).registerEvidence("EV-FAIL", sampleCaseId, ethers.ZeroHash, sampleIpfsCid, officer.address)
      ).to.be.revertedWith("EvidenceChain: Invalid zero hash");
    });

    it("should reject registration from unauthorized caller", async function () {
      await expect(
        evidenceChain
          .connect(unauthorized)
          .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address)
      ).to.be.revertedWith("EvidenceChain: Caller is not an authorized operator");
    });
  });

  describe("Chain of Custody Transitions", function () {
    beforeEach(async function () {
      await evidenceChain
        .connect(operator)
        .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address);
    });

    it("should record TRANSFERRED custody event correctly", async function () {
      // Officer transfers custody to Forensic Specialist
      await evidenceChain
        .connect(operator)
        .recordCustodyEvent(
          sampleEvidenceId,
          2, // CustodyAction.TRANSFERRED
          officer.address,
          officer.address,
          forensic.address,
          "Transferred to Cyber Forensics Unit for analysis"
        );

      const count = await evidenceChain.getCustodyHistoryCount(sampleEvidenceId);
      expect(count).to.equal(2n);

      const custodyRec = await evidenceChain.getCustodyRecord(sampleEvidenceId, 1);
      expect(custodyRec.action).to.equal(2);
      expect(custodyRec.actor).to.equal(officer.address);
      expect(custodyRec.fromUser).to.equal(officer.address);
      expect(custodyRec.toUser).to.equal(forensic.address);
      expect(custodyRec.reason).to.equal("Transferred to Cyber Forensics Unit for analysis");
    });

    it("should record ANALYZED and VERIFIED custody events", async function () {
      // Forensic analyzes
      await evidenceChain
        .connect(operator)
        .recordCustodyEvent(
          sampleEvidenceId,
          3, // CustodyAction.ANALYZED
          forensic.address,
          addressZero(),
          forensic.address,
          "Extracted video keyframes and verified audio metadata"
        );

      // Judge verifies
      await evidenceChain
        .connect(operator)
        .recordCustodyEvent(
          sampleEvidenceId,
          4, // CustodyAction.VERIFIED
          judge.address,
          addressZero(),
          addressZero(),
          "Court judicial verification confirmed hash match"
        );

      const count = await evidenceChain.getCustodyHistoryCount(sampleEvidenceId);
      expect(count).to.equal(3n);

      const lastRec = await evidenceChain.getCustodyRecord(sampleEvidenceId, 2);
      expect(lastRec.action).to.equal(4); // VERIFIED
      expect(lastRec.actor).to.equal(judge.address);
    });

    it("should revert custody recording for non-existent evidence", async function () {
      await expect(
        evidenceChain
          .connect(operator)
          .recordCustodyEvent(
            "NON-EXISTENT-ID",
            1,
            officer.address,
            addressZero(),
            addressZero(),
            "Access attempt"
          )
      ).to.be.revertedWith("EvidenceChain: Evidence does not exist");
    });
  });

  describe("Cryptographic Hash Verification", function () {
    beforeEach(async function () {
      await evidenceChain
        .connect(operator)
        .registerEvidence(sampleEvidenceId, sampleCaseId, sampleSha256Hex, sampleIpfsCid, officer.address);
    });

    it("should return true for identical matching SHA-256 hash", async function () {
      const isMatch = await evidenceChain.verifyEvidenceHash(sampleEvidenceId, sampleSha256Hex);
      expect(isMatch).to.be.true;
    });

    it("should return false for tampered / mismatched SHA-256 hash", async function () {
      const tamperedHash = "0x1111111111111111111111111111111111111111111111111111111111111111";
      const isMatch = await evidenceChain.verifyEvidenceHash(sampleEvidenceId, tamperedHash);
      expect(isMatch).to.be.false;
    });
  });
});

function addressZero() {
  return "0x0000000000000000000000000000000000000000";
}
