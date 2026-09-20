const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LoanManager Contract", function () {
  let mockUSDC, creditRegistry, lendingPool, loanManager;
  let owner, borrower, lender, stranger;
  const DECIMALS = 6n;
  const ONE_USDC = 10n ** DECIMALS;

  beforeEach(async function () {
    [owner, borrower, lender, stranger] = await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();

    // 2. Deploy CreditRegistry
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistryFactory.deploy(owner.address);

    // 3. Deploy LendingPool
    const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPoolFactory.deploy(await mockUSDC.getAddress(), owner.address);

    // 4. Deploy LoanManager
    const LoanManagerFactory = await ethers.getContractFactory("LoanManager");
    loanManager = await LoanManagerFactory.deploy(
      await creditRegistry.getAddress(),
      await lendingPool.getAddress(),
      owner.address
    );

    // 5. Authorize LoanManager in CreditRegistry & LendingPool
    await creditRegistry.connect(owner).setLoanManager(await loanManager.getAddress());
    await lendingPool.connect(owner).setLoanManager(await loanManager.getAddress());

    // 6. Fund lender and borrower with test tokens
    await mockUSDC.connect(lender).faucet(lender.address, 10_000n * ONE_USDC);
    await mockUSDC.connect(borrower).faucet(borrower.address, 10_000n * ONE_USDC);

    // Approve LendingPool
    await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), ethers.MaxUint256);
  });

  describe("Loan Creation & Onchain Borrowing Limit Gate", function () {
    it("Should allow a borrower to create a loan within their onchain borrowing limit", async function () {
      const loanAmount = 500n * ONE_USDC; // Default limit for 500 score is 500 USDC
      const duration = 7 * 24 * 3600;     // 7 days
      const interestRate = 1000;          // 10% APR

      await expect(
        loanManager.connect(borrower).createLoan(loanAmount, duration, interestRate)
      )
        .to.emit(loanManager, "LoanCreated")
        .withArgs(1, borrower.address, loanAmount, interestRate, duration);

      const loan = await loanManager.getLoan(1);
      expect(loan.loanId).to.equal(1);
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.principal).to.equal(loanAmount);
      expect(loan.status).to.equal(0); // REQUESTED
    });

    it("Should STRICTLY REVERT if requested amount exceeds onchain borrowing limit", async function () {
      const excessiveAmount = 501n * ONE_USDC; // 1 USDC above limit
      const duration = 7 * 24 * 3600;
      const interestRate = 1000;

      await expect(
        loanManager.connect(borrower).createLoan(excessiveAmount, duration, interestRate)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");
    });

    it("Should revert if duration is invalid", async function () {
      await expect(
        loanManager.connect(borrower).createLoan(100n * ONE_USDC, 30 * 60, 1000) // 30 mins < 1 hour
      ).to.be.revertedWith("LoanManager: Duration below minimum (1 hour)");

      await expect(
        loanManager.connect(borrower).createLoan(100n * ONE_USDC, 400 * 24 * 3600, 1000) // > 365 days
      ).to.be.revertedWith("LoanManager: Duration exceeds maximum (365 days)");
    });

    it("Should revert if interest rate exceeds maximum", async function () {
      await expect(
        loanManager.connect(borrower).createLoan(100n * ONE_USDC, 7 * 24 * 3600, 6000) // 60% > 50%
      ).to.be.revertedWith("LoanManager: Interest rate exceeds maximum (50%)");
    });
  });

  describe("Loan Funding Flow (REQUESTED -> ACTIVE)", function () {
    let loanId;
    const loanAmount = 300n * ONE_USDC;
    const duration = 7 * 24 * 3600;
    const interestRate = 1000; // 10%

    beforeEach(async function () {
      const tx = await loanManager.connect(borrower).createLoan(loanAmount, duration, interestRate);
      await tx.wait();
      loanId = 1;
    });

    it("Should transition loan from REQUESTED to ACTIVE and transfer tokens", async function () {
      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);

      await expect(loanManager.connect(lender).fundLoan(loanId))
        .to.emit(loanManager, "LoanFunded");

      const loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(1); // ACTIVE
      expect(loan.lender).to.equal(lender.address);
      expect(loan.startTime).to.be.gt(0);
      expect(loan.dueDate).to.equal(loan.startTime + BigInt(duration));

      // Tokens transferred
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalBefore + loanAmount);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore - loanAmount);
    });

    it("Should prevent borrower from funding their own loan", async function () {
      await expect(
        loanManager.connect(borrower).fundLoan(loanId)
      ).to.be.revertedWith("LoanManager: Borrower cannot fund their own loan");
    });

    it("Should prevent double funding (REQUESTED -> ACTIVE only once)", async function () {
      await loanManager.connect(lender).fundLoan(loanId);

      // Second fund attempt must revert
      await expect(
        loanManager.connect(stranger).fundLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");
    });
  });

  describe("Repayment Flow & Credit Score Update (ACTIVE -> REPAID)", function () {
    let loanId;
    const loanAmount = 250n * ONE_USDC;
    const duration = 7 * 24 * 3600;
    const interestRate = 1000; // 10% APR

    beforeEach(async function () {
      await loanManager.connect(borrower).createLoan(loanAmount, duration, interestRate);
      loanId = 1;
      await loanManager.connect(lender).fundLoan(loanId);
    });

    it("Should repay active loan, transition to REPAID, and update credit score", async function () {
      const totalDue = await loanManager.calculateTotalDue(loanId);
      expect(totalDue).to.be.gte(loanAmount);

      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);

      await expect(loanManager.connect(borrower).repayLoan(loanId))
        .to.emit(loanManager, "LoanRepaid")
        .withArgs(loanId, borrower.address, totalDue, true, true);

      const loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(2); // REPAID

      // Lender received principal + interest
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore + totalDue);

      // Borrower credit score should have increased from 500 to 570 (50 on-time + 20 early)
      const newScore = await creditRegistry.getCreditScore(borrower.address);
      expect(newScore).to.equal(570);

      // Borrowing limit should have expanded
      const newLimit = await creditRegistry.getBorrowingLimit(borrower.address);
      expect(newLimit).to.be.gt(500n * ONE_USDC);
    });

    it("Should prevent non-borrower from repaying the loan", async function () {
      await expect(
        loanManager.connect(stranger).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Only the borrower can repay this loan");
    });

    it("Should prevent double repayment (REPAID -> REPAID forbidden)", async function () {
      await loanManager.connect(borrower).repayLoan(loanId);

      await expect(
        loanManager.connect(borrower).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("Should forbid repaying a loan that is in REQUESTED state", async function () {
      // Create new unfunded loan
      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, duration, interestRate);
      const unfundedLoanId = 2;

      await expect(
        loanManager.connect(borrower).repayLoan(unfundedLoanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });
  });

  describe("Default Flow (ACTIVE -> DEFAULTED)", function () {
    let loanId;
    const loanAmount = 200n * ONE_USDC;
    const duration = 24 * 3600; // 1 day

    beforeEach(async function () {
      await loanManager.connect(borrower).createLoan(loanAmount, duration, 1000);
      loanId = 1;
      await loanManager.connect(lender).fundLoan(loanId);
    });

    it("Should revert if marking default before due date has passed", async function () {
      await expect(
        loanManager.connect(lender).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not past due date");
    });

    it("Should mark default after due date, transition to DEFAULTED, and penalize credit", async function () {
      // Fast forward time past due date
      await ethers.provider.send("evm_increaseTime", [duration + 10]);
      await ethers.provider.send("evm_mine");

      await expect(loanManager.connect(lender).markDefault(loanId))
        .to.emit(loanManager, "LoanDefaulted")
        .withArgs(loanId, borrower.address, lender.address);

      const loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(3); // DEFAULTED

      // Score penalized by -150 (from 500 down to 350)
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350);
    });

    it("Should prevent non-lender and non-owner from marking default", async function () {
      await ethers.provider.send("evm_increaseTime", [duration + 10]);
      await ethers.provider.send("evm_mine");

      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Only the lender or owner can mark default");
    });
  });
});
