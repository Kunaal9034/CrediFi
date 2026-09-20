const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CreditRegistry Contract", function () {
  let creditRegistry;
  let owner, loanManagerSigner, borrower, stranger;

  // Base unit constants (6 decimals)
  const ONE_USDC = 1_000_000n;
  const BASE_LIMIT = 500_000_000n; // 500e6

  beforeEach(async function () {
    [owner, loanManagerSigner, borrower, stranger] = await ethers.getSigners();
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistryFactory.deploy(owner.address);

    // Authorize loanManagerSigner as loanManager
    await creditRegistry.connect(owner).setLoanManager(loanManagerSigner.address);
  });

  describe("1. Deployment & Constants", function () {
    it("1. Deployment initializes correctly", async function () {
      expect(await creditRegistry.owner()).to.equal(owner.address);
      expect(await creditRegistry.loanManager()).to.equal(loanManagerSigner.address);
      expect(await creditRegistry.MIN_SCORE()).to.equal(300);
      expect(await creditRegistry.BASE_SCORE()).to.equal(500);
      expect(await creditRegistry.MAX_SCORE()).to.equal(850);
      expect(await creditRegistry.BASE_LIMIT()).to.equal(BASE_LIMIT);
    });
  });

  describe("2-6. Defaults & Borrowing Limit Formula", function () {
    it("2. New borrower starts at score 500", async function () {
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500);
      const profile = await creditRegistry.getProfile(borrower.address);
      expect(profile.score).to.equal(500);
    });

    it("3. New borrower borrowing limit is 500e6", async function () {
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(500_000_000n);
    });

    it("4. Score below 350 gives zero borrowing limit", async function () {
      // 500 - 150 = 350, then -150 again = 300 (clamped)
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 100_000_000n);
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 100_000_000n);

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(0n);
    });

    it("5. Score 570 gives 570e6 borrowing limit", async function () {
      // Early repayment: 500 + 70 = 570
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 200_000_000n, true, true);

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(570);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(570_000_000n);
    });

    it("6. Score 640 gives 640e6 borrowing limit", async function () {
      // Two early repayments: 500 + 70 + 70 = 640
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 200_000_000n, true, true);
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 200_000_000n, true, true);

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(640);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(640_000_000n);
    });
  });

  describe("7-9. Access Control", function () {
    it("7. Unauthorized user cannot call recordLoan", async function () {
      await expect(
        creditRegistry.connect(stranger).recordLoan(borrower.address, 100_000_000n)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("8. Unauthorized user cannot call recordRepayment", async function () {
      await expect(
        creditRegistry.connect(stranger).recordRepayment(borrower.address, 100_000_000n, true, false)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("9. Unauthorized user cannot call recordDefault", async function () {
      await expect(
        creditRegistry.connect(stranger).recordDefault(borrower.address, 100_000_000n)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("Borrower cannot directly modify their own score", async function () {
      await expect(
        creditRegistry.connect(borrower).recordRepayment(borrower.address, 100_000_000n, true, true)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("Only owner can set loanManager and rejects zero address", async function () {
      await expect(
        creditRegistry.connect(stranger).setLoanManager(stranger.address)
      ).to.be.revertedWithCustomError(creditRegistry, "OwnableUnauthorizedAccount");

      await expect(
        creditRegistry.connect(owner).setLoanManager(ethers.ZeroAddress)
      ).to.be.revertedWith("CreditRegistry: Invalid LoanManager address");

      await expect(creditRegistry.connect(owner).setLoanManager(stranger.address))
        .to.emit(creditRegistry, "LoanManagerUpdated")
        .withArgs(loanManagerSigner.address, stranger.address);

      expect(await creditRegistry.loanManager()).to.equal(stranger.address);
    });
  });

  describe("10-12. recordLoan Behavior", function () {
    it("10. recordLoan increments totalLoans", async function () {
      await creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 250_000_000n);
      const profile = await creditRegistry.getProfile(borrower.address);
      expect(profile.totalLoans).to.equal(1n);

      await creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 150_000_000n);
      const profile2 = await creditRegistry.getProfile(borrower.address);
      expect(profile2.totalLoans).to.equal(2n);
    });

    it("11. recordLoan increments totalBorrowed", async function () {
      await creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 250_000_000n);
      const profile = await creditRegistry.getProfile(borrower.address);
      expect(profile.totalBorrowed).to.equal(250_000_000n);

      await creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 150_000_000n);
      const profile2 = await creditRegistry.getProfile(borrower.address);
      expect(profile2.totalBorrowed).to.equal(400_000_000n);
    });

    it("12. recordLoan does not change score", async function () {
      await creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 300_000_000n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(500_000_000n);
    });
  });

  describe("13-16. Scoring Adjustments", function () {
    it("13. on-time repayment adds 50", async function () {
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 250_000_000n, true, false);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(550);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(550_000_000n);
    });

    it("14. early repayment adds 70", async function () {
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 200_000_000n, true, true);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(570);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(570_000_000n);
    });

    it("15. late repayment subtracts 40", async function () {
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 200_000_000n, false, false);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(460);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(460_000_000n);
    });

    it("16. default subtracts 150", async function () {
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 200_000_000n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(350_000_000n);
    });
  });

  describe("17-18. Clamping & Invariants", function () {
    it("17. score cannot exceed 850", async function () {
      // 500 + 5 * 70 = 850, then one more should clamp at 850
      for (let i = 0; i < 7; i++) {
        await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 100_000_000n, true, true);
      }
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(850);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(850_000_000n);
    });

    it("18. score cannot fall below 300", async function () {
      // 500 - 150 = 350, then - 150 = 300, then - 150 should stay 300
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 100_000_000n);
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 100_000_000n);
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 100_000_000n);

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(0n);
    });
  });

  describe("19-20. Input Validation", function () {
    it("19. zero borrower is rejected", async function () {
      await expect(
        creditRegistry.connect(loanManagerSigner).recordLoan(ethers.ZeroAddress, 100_000_000n)
      ).to.be.revertedWith("CreditRegistry: Invalid borrower");

      await expect(
        creditRegistry.connect(loanManagerSigner).recordRepayment(ethers.ZeroAddress, 100_000_000n, true, false)
      ).to.be.revertedWith("CreditRegistry: Invalid borrower");

      await expect(
        creditRegistry.connect(loanManagerSigner).recordDefault(ethers.ZeroAddress, 100_000_000n)
      ).to.be.revertedWith("CreditRegistry: Invalid borrower");
    });

    it("20. zero principal is rejected", async function () {
      await expect(
        creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 0n)
      ).to.be.revertedWith("CreditRegistry: Invalid principal");

      await expect(
        creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 0n, true, false)
      ).to.be.revertedWith("CreditRegistry: Invalid principal");

      await expect(
        creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 0n)
      ).to.be.revertedWith("CreditRegistry: Invalid principal");
    });
  });

  describe("21-22. Events & Accounting", function () {
    it("21. CreditProfileUpdated event is emitted with correct values", async function () {
      // on-time repayment: score 500 -> 550, limit 550e6
      await expect(
        creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 200_000_000n, true, false)
      )
        .to.emit(creditRegistry, "CreditProfileUpdated")
        .withArgs(borrower.address, 550n, 550_000_000n);
    });

    it("22. Repayment/default accounting is correct", async function () {
      // 1. Record Loan
      await creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 500_000_000n);

      // 2. Record Repayment
      await creditRegistry.connect(loanManagerSigner).recordRepayment(borrower.address, 500_000_000n, true, true);

      // 3. Record Another Loan
      await creditRegistry.connect(loanManagerSigner).recordLoan(borrower.address, 300_000_000n);

      // 4. Record Default
      await creditRegistry.connect(loanManagerSigner).recordDefault(borrower.address, 300_000_000n);

      const profile = await creditRegistry.getProfile(borrower.address);
      expect(profile.totalLoans).to.equal(2n);
      expect(profile.repaidLoans).to.equal(1n);
      expect(profile.defaultedLoans).to.equal(1n);
      expect(profile.totalBorrowed).to.equal(800_000_000n);
      expect(profile.totalRepaid).to.equal(500_000_000n);
      expect(profile.score).to.equal(420n); // 500 + 70 - 150 = 420
      expect(profile.lastUpdated).to.be.gt(0n);
    });
  });
});
