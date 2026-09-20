const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 12 — Default Handling and Late Repayment Suite", function () {
  let mockUSDC;
  let creditRegistry;
  let lendingPool;
  let loanManager;

  let owner;
  let borrower;
  let lender;
  let stranger;

  const ONE_USDC = 1_000_000n; // 6 decimals
  const loanPrincipal = 100n * ONE_USDC; // 100 mUSDC
  const loanRateBps = 1000n; // 10.00% APR
  const duration = 10n * 86400n; // 10 days
  const GRACE_PERIOD = 86400n; // 1 day grace period

  beforeEach(async function () {
    [owner, borrower, lender, stranger] = await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // 2. Deploy CreditRegistry
    const CreditRegistry = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistry.deploy(owner.address);
    await creditRegistry.waitForDeployment();

    // 3. Deploy LendingPool
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(await mockUSDC.getAddress(), owner.address);
    await lendingPool.waitForDeployment();

    // 4. Deploy LoanManager
    const LoanManager = await ethers.getContractFactory("LoanManager");
    loanManager = await LoanManager.deploy(
      await creditRegistry.getAddress(),
      await lendingPool.getAddress(),
      owner.address
    );
    await loanManager.waitForDeployment();

    // 5. Wire dependencies
    await creditRegistry.setLoanManager(await loanManager.getAddress());
    await lendingPool.setLoanManager(await loanManager.getAddress());

    // 6. Fund participants via faucet
    await mockUSDC.faucet(borrower.address, 10_000n * ONE_USDC);
    await mockUSDC.faucet(lender.address, 10_000n * ONE_USDC);

    // 7. Approve LendingPool
    await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), ethers.MaxUint256);
  });

  async function createAndFundLoan() {
    await loanManager.connect(borrower).createLoan(loanPrincipal, loanRateBps, duration);
    const loanId = await loanManager.loanCounter();
    await loanManager.connect(lender).fundLoan(loanId);
    return loanId;
  }

  describe("TEST A — Default before grace period", function () {
    it("Should strictly revert markDefault if attempted before dueDate + grace period", async function () {
      const loanId = await createAndFundLoan();

      // Advance to dueDate + 12 hours (within 24-hour grace period)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 12 * 3600]);
      await ethers.provider.send("evm_mine");

      const scoreBefore = await creditRegistry.getCreditScore(borrower.address);
      const exposureBefore = await loanManager.getOutstandingPrincipal(borrower.address);

      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not past due date plus grace period");

      // Verify onchain state remains unchanged
      const loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(1n); // Remains ACTIVE
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(scoreBefore);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(exposureBefore);
    });
  });

  describe("TEST B — Late repayment behavior", function () {
    it("Should allow borrower to repay after grace period with -40 score penalty", async function () {
      const loanId = await createAndFundLoan();
      const loan = await loanManager.getLoan(loanId);
      const totalDue = loan.totalDue;

      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);
      const scoreBefore = await creditRegistry.getCreditScore(borrower.address);
      expect(scoreBefore).to.equal(500n);

      // Advance time past dueDate + grace period (10 days duration + 1 day grace + 1 hour)
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 3600n)]);
      await ethers.provider.send("evm_mine");

      // Borrower settles late debt
      const tx = await loanManager.connect(borrower).repayLoan(loanId);
      const receipt = await tx.wait();

      // Check LoanRepaid event emitted with LATE type (2)
      await expect(tx)
        .to.emit(loanManager, "LoanRepaid")
        .withArgs(loanId, borrower.address, lender.address, loanPrincipal, totalDue, 2); // 2 = LATE

      // Check onchain state
      const loanAfter = await loanManager.getLoan(loanId);
      expect(loanAfter.status).to.equal(2n); // REPAID

      // Check exact token transfer
      const borrowerBalAfter = await mockUSDC.balanceOf(borrower.address);
      const lenderBalAfter = await mockUSDC.balanceOf(lender.address);
      expect(borrowerBalAfter).to.equal(borrowerBalBefore - totalDue);
      expect(lenderBalAfter).to.equal(lenderBalBefore + totalDue);

      // Check credit score penalty: 500 - 40 = 460
      const scoreAfter = await creditRegistry.getCreditScore(borrower.address);
      expect(scoreAfter).to.equal(460n);

      // Check exposure released to 0
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
    });
  });

  describe("TEST C — Default after grace period", function () {
    it("Should allow markDefault after grace period with -150 penalty and zero token movement", async function () {
      const loanId = await createAndFundLoan();

      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);
      const scoreBefore = await creditRegistry.getCreditScore(borrower.address);
      expect(scoreBefore).to.equal(500n);

      // Advance time past dueDate + grace period (10 days + 1 day + 10s)
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 10n)]);
      await ethers.provider.send("evm_mine");

      // Stranger marks loan as defaulted
      const tx = await loanManager.connect(stranger).markDefault(loanId);

      // Check LoanDefaulted event
      await expect(tx)
        .to.emit(loanManager, "LoanDefaulted")
        .withArgs(loanId, borrower.address, lender.address, loanPrincipal);

      // Check loan state
      const loanAfter = await loanManager.getLoan(loanId);
      expect(loanAfter.status).to.equal(3n); // DEFAULTED

      // Zero token movement verified
      const borrowerBalAfter = await mockUSDC.balanceOf(borrower.address);
      const lenderBalAfter = await mockUSDC.balanceOf(lender.address);
      expect(borrowerBalAfter).to.equal(borrowerBalBefore);
      expect(lenderBalAfter).to.equal(lenderBalBefore);

      // Check credit score penalty: 500 - 150 = 350
      const scoreAfter = await creditRegistry.getCreditScore(borrower.address);
      expect(scoreAfter).to.equal(350n);

      // Check exposure released to 0
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
    });
  });

  describe("TEST D — Repayment of defaulted loan", function () {
    it("Should strictly revert if borrower attempts to repay a DEFAULTED loan", async function () {
      const loanId = await createAndFundLoan();

      // Advance past grace and default
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 10n)]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(loanId);

      // Repay attempt
      await expect(
        loanManager.connect(borrower).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });
  });

  describe("TEST E & F — Duplicate action prevention", function () {
    it("Should strictly revert duplicate markDefault on already DEFAULTED loan", async function () {
      const loanId = await createAndFundLoan();
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 10n)]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(loanId);

      // Second default
      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("Should strictly revert duplicate repayLoan on already REPAID loan", async function () {
      const loanId = await createAndFundLoan();
      await loanManager.connect(borrower).repayLoan(loanId);

      // Second repay
      await expect(
        loanManager.connect(borrower).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("Should strictly revert markDefault on already REPAID loan", async function () {
      const loanId = await createAndFundLoan();
      await loanManager.connect(borrower).repayLoan(loanId);

      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 10n)]);
      await ethers.provider.send("evm_mine");

      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });
  });

  describe("TEST G — Permissionless default caller verification", function () {
    it("Should allow any caller (lender, stranger, borrower) to mark default after grace period", async function () {
      const loanId = await createAndFundLoan();
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 10n)]);
      await ethers.provider.send("evm_mine");

      // Random stranger triggers default
      await expect(loanManager.connect(stranger).markDefault(loanId)).to.not.be.reverted;
    });
  });

  describe("TEST H — Credit score boundary and clamping at MIN_SCORE (300)", function () {
    it("Should clamp score at MIN_SCORE (300) when default penalty (-150) would drop below 300", async function () {
      // Create first loan and default it -> score drops 500 -> 350
      const loan1 = await createAndFundLoan();
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 10n)]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(loan1);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350n);

      // Create second loan and default it -> 350 - 150 = 200, but clamped at MIN_SCORE 300
      // To borrow with score 350, limit is 350/500 * 500 = 350 USDC
      const smallPrincipal = 50n * ONE_USDC;
      await loanManager.connect(borrower).createLoan(smallPrincipal, loanRateBps, duration);
      const loan2 = await loanManager.loanCounter();
      await loanManager.connect(lender).fundLoan(loan2);

      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 10n)]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(loan2);

      // Must be strictly clamped at 300
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300n);
    });

    it("Should clamp score at MIN_SCORE (300) when late repayment penalty (-40) would drop below 300", async function () {
      // Create 3 loans upfront while borrower has score 500 (limit 500 USDC)
      const p = 50n * ONE_USDC;
      await loanManager.connect(borrower).createLoan(p, loanRateBps, duration);
      const l1 = 1n;
      await loanManager.connect(lender).fundLoan(l1);

      await loanManager.connect(borrower).createLoan(p, loanRateBps, duration);
      const l2 = 2n;
      await loanManager.connect(lender).fundLoan(l2);

      await loanManager.connect(borrower).createLoan(p, loanRateBps, duration);
      const l3 = 3n;
      await loanManager.connect(lender).fundLoan(l3);

      // Advance past grace period
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 3600n)]);
      await ethers.provider.send("evm_mine");

      // 1. Default loan 1 -> score drops 500 - 150 = 350
      await loanManager.connect(stranger).markDefault(l1);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350n);

      // 2. Late repay loan 2 -> score drops 350 - 40 = 310
      await loanManager.connect(borrower).repayLoan(l2);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(310n);

      // 3. Late repay loan 3 -> score drops 310 - 40 = 270, strictly clamped at MIN_SCORE (300)
      await loanManager.connect(borrower).repayLoan(l3);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300n);
    });

    it("Explicitly verify when score = 300: late repayment 300 - 40 => 300, and default 300 - 150 => 300", async function () {
      // Create 4 loans upfront while borrower has score 500 (total exposure 4 * 50 = 200 <= 500)
      const p = 50n * ONE_USDC;
      for (let i = 1; i <= 4; i++) {
        await loanManager.connect(borrower).createLoan(p, loanRateBps, duration);
        await loanManager.connect(lender).fundLoan(BigInt(i));
      }

      // Advance past grace period
      await ethers.provider.send("evm_increaseTime", [Number(duration + GRACE_PERIOD + 3600n)]);
      await ethers.provider.send("evm_mine");

      // Loan 1 default: 500 - 150 = 350
      await loanManager.connect(stranger).markDefault(1n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350n);

      // Loan 2 default: 350 - 150 = 200 => clamps at 300
      await loanManager.connect(stranger).markDefault(2n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300n);

      // Now borrower's score is exactly 300.
      // Test late repayment on Loan 3: 300 - 40 => must remain exactly 300
      await loanManager.connect(borrower).repayLoan(3n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300n);

      // Test default on Loan 4: 300 - 150 => must remain exactly 300
      await loanManager.connect(stranger).markDefault(4n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300n);
    });
  });
});
