const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CreditRegistry Contract", function () {
  let creditRegistry;
  let owner, loanManagerSigner, borrower, stranger;
  const DECIMALS = 6n;
  const ONE_USDC = 10n ** DECIMALS;

  beforeEach(async function () {
    [owner, loanManagerSigner, borrower, stranger] = await ethers.getSigners();
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistryFactory.deploy(owner.address);

    // Authorize loanManagerSigner as loanManager
    await creditRegistry.connect(owner).setLoanManager(loanManagerSigner.address);
  });

  describe("Initialization & Defaults", function () {
    it("Should return initial default score of 500 for uninitialized addresses", async function () {
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500);
    });

    it("Should compute initial borrowing limit of 500 USDC for score 500", async function () {
      const expectedLimit = 500n * ONE_USDC;
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(expectedLimit);
    });

    it("Should return initialized profile with zero counts", async function () {
      const profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.score).to.equal(500);
      expect(profile.loansTaken).to.equal(0);
      expect(profile.loansRepaid).to.equal(0);
      expect(profile.defaults).to.equal(0);
      expect(profile.totalBorrowed).to.equal(0);
      expect(profile.totalRepaid).to.equal(0);
    });
  });

  describe("Access Control Protection", function () {
    it("Should revert if an unauthorized caller tries to record a loan", async function () {
      await expect(
        creditRegistry.connect(stranger).recordLoan(borrower.address, 100n * ONE_USDC)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("Should revert if an unauthorized caller tries to record a repayment", async function () {
      await expect(
        creditRegistry.connect(borrower).recordRepayment(borrower.address, 100n * ONE_USDC, true, false)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("Should revert if an unauthorized caller tries to record a default", async function () {
      await expect(
        creditRegistry.connect(stranger).recordDefault(borrower.address)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("Should allow only the contract owner to update the loanManager address", async function () {
      await expect(
        creditRegistry.connect(stranger).setLoanManager(stranger.address)
      ).to.be.revertedWithCustomError(creditRegistry, "OwnableUnauthorizedAccount");

      await expect(creditRegistry.connect(owner).setLoanManager(stranger.address))
        .to.emit(creditRegistry, "LoanManagerUpdated")
        .withArgs(loanManagerSigner.address, stranger.address);

      expect(await creditRegistry.loanManager()).to.equal(stranger.address);
    });
  });

  describe("Deterministic Scoring Operations", function () {
    it("Should record loan incrementing loansTaken and totalBorrowed", async function () {
      const borrowAmount = 250n * ONE_USDC;
      await expect(
        creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, borrowAmount)
      )
        .to.emit(creditRegistry, "LoanRecorded")
        .withArgs(borrower.address, borrowAmount, borrowAmount);

      const profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.loansTaken).to.equal(1);
      expect(profile.totalBorrowed).to.equal(borrowAmount);
    });

    it("Should increase score by 50 for on-time repayment and scale limit", async function () {
      const repayAmount = 250n * ONE_USDC;
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, repayAmount, true, false);

      const newScore = await creditRegistry.getCreditScore(borrower.address);
      expect(newScore).to.equal(550); // 500 + 50

      // Limit at 550: 500 + 50*10 = 1000 USDC
      const newLimit = await creditRegistry.getBorrowingLimit(borrower.address);
      expect(newLimit).to.equal(1_000n * ONE_USDC);
    });

    it("Should increase score by 70 (50 + 20) for early repayment", async function () {
      const repayAmount = 200n * ONE_USDC;
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, repayAmount, true, true);

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(570); // 500 + 50 + 20
    });

    it("Should decrease score by 40 for late repayment", async function () {
      const repayAmount = 200n * ONE_USDC;
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, repayAmount, false, false);

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(460); // 500 - 40
      // Limit at 460 (below 500): (460 - 300) * 2.5 = 160 * 2.5 = 400 USDC
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(400n * ONE_USDC);
    });

    it("Should decrease score by 150 for default", async function () {
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address);

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350); // 500 - 150
      const profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.defaults).to.equal(1);
    });

    it("Should clamp score between MIN_SCORE (300) and MAX_SCORE (850)", async function () {
      // Multiple defaults
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address); // 350
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address); // 300 (clamped)
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address); // 300 (clamped)

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(0); // 0 borrowing power at min score

      // High repayments
      for (let i = 0; i < 10; i++) {
        await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 100n * ONE_USDC, true, true);
      }
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(850);
      // Limit at 850: 500 + (350 * 10) = 4,000 USDC
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(4_000n * ONE_USDC);
    });
  });
});
