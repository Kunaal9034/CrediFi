const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrediFi Protocol — Integration, Security & Invariant Audit Suite", function () {
  let mockUSDC, creditRegistry, lendingPool, loanManager;
  let owner, borrower, lender, stranger, liquidator;
  const DECIMALS = 6n;
  const ONE_USDC = 10n ** DECIMALS;

  beforeEach(async function () {
    [owner, borrower, lender, stranger, liquidator] = await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();

    // 2. Deploy CreditRegistry
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistryFactory.deploy(owner.address);

    // 3. Deploy LendingPool
    const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPoolFactory.deploy(
      await mockUSDC.getAddress(),
      owner.address // Initially owner, wired to LoanManager below
    );

    // 4. Deploy LoanManager
    const LoanManagerFactory = await ethers.getContractFactory("LoanManager");
    loanManager = await LoanManagerFactory.deploy(
      await creditRegistry.getAddress(),
      await lendingPool.getAddress(),
      owner.address
    );

    // 5. Cross-contract Authorization Linkages
    await creditRegistry.connect(owner).setLoanManager(await loanManager.getAddress());
    await lendingPool.connect(owner).setLoanManager(await loanManager.getAddress());

    // 6. Fund test participants with tokens
    await mockUSDC.connect(borrower).faucet(borrower.address, 10_000n * ONE_USDC);
    await mockUSDC.connect(lender).faucet(lender.address, 10_000n * ONE_USDC);
    await mockUSDC.connect(stranger).faucet(stranger.address, 10_000n * ONE_USDC);

    // 7. Approve LendingPool for token transfers
    await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(stranger).approve(await lendingPool.getAddress(), ethers.MaxUint256);
  });

  // =========================================================================
  // INTEGRATION FLOWS 1 - 4
  // =========================================================================

  describe("Integration Flow 1: Successful Early Loan Lifecycle", function () {
    it("Executes end-to-end early repayment: score +70, balances reconciled, zero pool custody", async function () {
      // 1. Initial conditions
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500n);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(500n * ONE_USDC);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);

      const principal = 300n * ONE_USDC;
      const rateBps = 1000n; // 10%
      const duration = 30n * 86400n; // 30 days

      // 2. Create loan
      const createTx = await loanManager.connect(borrower).createLoan(principal, rateBps, duration);
      await expect(createTx).to.emit(loanManager, "LoanCreated");

      const loanId = 1n;
      let loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(0n); // REQUESTED
      expect(loan.borrower).to.equal(borrower.address);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(principal);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(200n * ONE_USDC);

      // Verify CreditRegistry has NOT recorded the loan yet
      let profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.totalLoans).to.equal(0n);

      // 3. Fund loan
      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);

      const fundTx = await loanManager.connect(lender).fundLoan(loanId);
      await expect(fundTx)
        .to.emit(loanManager, "LoanFunded")
        .and.to.emit(lendingPool, "FundsTransferred")
        .and.to.emit(creditRegistry, "LoanRecorded");

      loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(1n); // ACTIVE
      expect(loan.lender).to.equal(lender.address);

      // Balances updated exactly by principal
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalBefore + principal);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore - principal);
      expect(await mockUSDC.balanceOf(await lendingPool.getAddress())).to.equal(0n); // Zero pool custody

      // CreditRegistry profile updated
      profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.totalLoans).to.equal(1n);
      expect(profile.totalBorrowed).to.equal(principal);

      // 4. Early Repayment (before dueDate)
      const totalDue = loan.totalDue;
      const borrowerBalPreRepay = await mockUSDC.balanceOf(borrower.address);
      const lenderBalPreRepay = await mockUSDC.balanceOf(lender.address);

      const repayTx = await loanManager.connect(borrower).repayLoan(loanId);
      await expect(repayTx)
        .to.emit(loanManager, "LoanRepaid")
        .withArgs(loanId, borrower.address, lender.address, principal, totalDue, 0) // 0 = EARLY
        .and.to.emit(lendingPool, "RepaymentExecuted")
        .and.to.emit(creditRegistry, "RepaymentRecorded");

      loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(2n); // REPAID

      // Balances updated exactly by totalDue
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalPreRepay - totalDue);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalPreRepay + totalDue);
      expect(await mockUSDC.balanceOf(await lendingPool.getAddress())).to.equal(0n);

      // Exposure released
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);

      // Credit score increased: 500 + 70 = 570
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(570n);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(570n * ONE_USDC);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(570n * ONE_USDC);
    });
  });

  describe("Integration Flow 2: On-Time Repayment (Within Grace Period)", function () {
    it("Executes on-time repayment within 1-day grace period: score +50 (500 -> 550)", async function () {
      const principal = 250n * ONE_USDC;
      const duration = 10n * 86400n;

      await loanManager.connect(borrower).createLoan(principal, 1000n, duration);
      const loanId = 1n;
      await loanManager.connect(lender).fundLoan(loanId);

      // Fast-forward to dueDate + 12 hours (within DEFAULT_GRACE_PERIOD of 1 day)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 12 * 3600]);
      await ethers.provider.send("evm_mine");

      const repayTx = await loanManager.connect(borrower).repayLoan(loanId);
      await expect(repayTx)
        .to.emit(loanManager, "LoanRepaid")
        .withArgs(loanId, borrower.address, lender.address, principal, (await loanManager.getLoan(loanId)).totalDue, 1); // 1 = ON_TIME

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(550n); // 500 + 50
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(550n * ONE_USDC);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
    });
  });

  describe("Integration Flow 3: Late Repayment (After Grace Period, Pre-Default)", function () {
    it("Executes late repayment after grace period before default: score -40 (500 -> 460)", async function () {
      const principal = 200n * ONE_USDC;
      const duration = 5n * 86400n;

      await loanManager.connect(borrower).createLoan(principal, 1000n, duration);
      const loanId = 1n;
      await loanManager.connect(lender).fundLoan(loanId);

      // Fast-forward past dueDate + grace period (5 days + 1 day grace + 2 hours)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 7200]);
      await ethers.provider.send("evm_mine");

      // Borrower repays while still ACTIVE
      const repayTx = await loanManager.connect(borrower).repayLoan(loanId);
      await expect(repayTx)
        .to.emit(loanManager, "LoanRepaid")
        .withArgs(loanId, borrower.address, lender.address, principal, (await loanManager.getLoan(loanId)).totalDue, 2); // 2 = LATE

      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(460n); // 500 - 40
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(460n * ONE_USDC);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);

      // Verify no default was recorded
      const profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.defaultedLoans).to.equal(0n);
      expect(profile.repaidLoans).to.equal(1n);
    });
  });

  describe("Integration Flow 4: Default Flow", function () {
    it("Executes default triggered by third party: score -150 (500 -> 350), 0 token movement, second default fails", async function () {
      const principal = 300n * ONE_USDC;
      const duration = 3n * 86400n;

      await loanManager.connect(borrower).createLoan(principal, 1000n, duration);
      const loanId = 1n;
      await loanManager.connect(lender).fundLoan(loanId);

      // Time before grace period expires: default must revert
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 12 * 3600]);
      await ethers.provider.send("evm_mine");

      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not past due date plus grace period");

      // Advance past grace period (3 days + 1 day grace + 10s)
      await ethers.provider.send("evm_increaseTime", [12 * 3600 + 10]);
      await ethers.provider.send("evm_mine");

      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);
      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);

      // Third-party triggers default
      const defaultTx = await loanManager.connect(stranger).markDefault(loanId);
      await expect(defaultTx)
        .to.emit(loanManager, "LoanDefaulted")
        .withArgs(loanId, borrower.address, lender.address, principal)
        .and.to.emit(creditRegistry, "DefaultRecorded");

      const loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(3n); // DEFAULTED

      // Zero token transfers occurred upon default (unsecured credit lending)
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore);
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalBefore);

      // Credit score penalized: 500 - 150 = 350
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350n);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(350n * ONE_USDC);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);

      // Second default attempt fails
      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });
  });

  // =========================================================================
  // BORROWING CAPACITY ATTACKS
  // =========================================================================

  describe("Borrowing Capacity Attack Tests", function () {
    it("Prevents 300 + 200 + 1 bypass against 500 limit across REQUESTED and ACTIVE states", async function () {
      const rate = 1000n;
      const duration = 14n * 86400n;

      // 1. Create 300 USDC loan
      await loanManager.connect(borrower).createLoan(300n * ONE_USDC, rate, duration);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(300n * ONE_USDC);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(200n * ONE_USDC);

      // 2. Create 200 USDC loan
      await loanManager.connect(borrower).createLoan(200n * ONE_USDC, rate, duration);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(500n * ONE_USDC);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(0n);

      // 3. Attempt 1 USDC more -> MUST REVERT (REQUESTED + REQUESTED bypass prevention)
      await expect(
        loanManager.connect(borrower).createLoan(1n * ONE_USDC, rate, duration)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");

      // 4. Fund Loan 1 (300 USDC) -> transitions to ACTIVE. Capacity remains strictly reserved
      await loanManager.connect(lender).fundLoan(1n);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(500n * ONE_USDC);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(0n);

      // 5. Attempt loan while REQUESTED + ACTIVE = 500 -> MUST REVERT
      await expect(
        loanManager.connect(borrower).createLoan(1n * ONE_USDC, rate, duration)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");

      // 6. Fund Loan 2 (200 USDC) -> both now ACTIVE. Capacity remains strictly reserved
      await loanManager.connect(lender).fundLoan(2n);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(500n * ONE_USDC);

      // 7. Attempt loan while ACTIVE + ACTIVE = 500 -> MUST REVERT
      await expect(
        loanManager.connect(borrower).createLoan(1n * ONE_USDC, rate, duration)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");

      // 8. Repay Loan 1 (300 USDC) -> releases 300 USDC of capacity
      await loanManager.connect(borrower).repayLoan(1n);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(200n * ONE_USDC);

      // New score is 570, so limit is 570 USDC. Available power = 570 - 200 = 370 USDC
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(370n * ONE_USDC);

      // 9. Successfully create new loan using released capacity
      await expect(
        loanManager.connect(borrower).createLoan(350n * ONE_USDC, rate, duration)
      ).to.not.be.reverted;
    });
  });

  // =========================================================================
  // CREDIT SCORE BOUNDARIES & FORMULAS
  // =========================================================================

  describe("Credit Score Boundary & Borrowing Limit Tests", function () {
    it("Strictly clamps credit score within [300, 850] and verifies exact cutoff thresholds", async function () {
      // 1. New borrower default
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500n);
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(500n * ONE_USDC);

      // 2. Drive score up to 850 with repeated repayments
      const duration = 2n * 86400n;
      // 500 + 70*5 = 850 (at 5th loan, score reaches 850 and clamps)
      for (let i = 1; i <= 6; i++) {
        await loanManager.connect(borrower).createLoan(100n * ONE_USDC, 1000n, duration);
        await loanManager.connect(lender).fundLoan(BigInt(i));
        await loanManager.connect(borrower).repayLoan(BigInt(i));
      }
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(850n); // MAX_SCORE clamped
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(850n * ONE_USDC);

      // 3. Drive score down with repeated defaults
      // 850 - 150*4 = 250 -> clamps at MIN_SCORE = 300
      for (let i = 7; i <= 10; i++) {
        await loanManager.connect(borrower).createLoan(100n * ONE_USDC, 1000n, duration);
        await loanManager.connect(lender).fundLoan(BigInt(i));
        await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
        await ethers.provider.send("evm_mine");
        await loanManager.connect(stranger).markDefault(BigInt(i));
      }
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(300n); // MIN_SCORE clamped

      // Below 350 cutoff: borrowing limit must be 0
      expect(await creditRegistry.getBorrowingLimit(borrower.address)).to.equal(0n);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(0n);

      // Subprime borrower cannot create loans
      await expect(
        loanManager.connect(borrower).createLoan(10n * ONE_USDC, 1000n, duration)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");
    });
  });

  // =========================================================================
  // STATE MACHINE ATTACKS (ALL 9 FORBIDDEN TRANSITIONS)
  // =========================================================================

  describe("State Machine Attack Invariants", function () {
    it("Reverts on all 9 forbidden state transitions", async function () {
      const p = 200n * ONE_USDC;
      const d = 2n * 86400n;

      // 1. Create loan (REQUESTED)
      await loanManager.connect(borrower).createLoan(p, 1000n, d);
      const id1 = 1n;

      // Transition 1: REQUESTED -> REPAID ❌
      await expect(loanManager.connect(borrower).repayLoan(id1)).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // Transition 2: REQUESTED -> DEFAULTED ❌
      await expect(loanManager.connect(stranger).markDefault(id1)).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // Fund loan (ACTIVE)
      await loanManager.connect(lender).fundLoan(id1);

      // Transition 3: ACTIVE -> ACTIVE (second funding) ❌
      await expect(loanManager.connect(lender).fundLoan(id1)).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");

      // Repay loan (REPAID)
      await loanManager.connect(borrower).repayLoan(id1);

      // Transition 4: REPAID -> ACTIVE ❌
      await expect(loanManager.connect(lender).fundLoan(id1)).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");

      // Transition 5: REPAID -> REPAID ❌
      await expect(loanManager.connect(borrower).repayLoan(id1)).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // Transition 6: REPAID -> DEFAULTED ❌
      await expect(loanManager.connect(stranger).markDefault(id1)).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // Create and fund second loan to test DEFAULTED transitions
      await loanManager.connect(borrower).createLoan(p, 1000n, d);
      const id2 = 2n;
      await loanManager.connect(lender).fundLoan(id2);

      await ethers.provider.send("evm_increaseTime", [Number(d) + 86400 + 10]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(id2);

      // Transition 7: DEFAULTED -> ACTIVE ❌
      await expect(loanManager.connect(lender).fundLoan(id2)).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");

      // Transition 8: DEFAULTED -> REPAID ❌
      await expect(loanManager.connect(borrower).repayLoan(id2)).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // Transition 9: DEFAULTED -> DEFAULTED ❌
      await expect(loanManager.connect(stranger).markDefault(id2)).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });
  });

  // =========================================================================
  // FUNDING & REPAYMENT ATTACKS & FAILURE ATOMICITY
  // =========================================================================

  describe("Funding, Repayment Attacks & Failure Atomicity", function () {
    it("Verifies funding attacks and failure atomicity", async function () {
      const p = 300n * ONE_USDC;
      const d = 10n * 86400n;

      await loanManager.connect(borrower).createLoan(p, 1000n, d);
      const loanId = 1n;

      // 1. Borrower self-funding rejected
      await expect(
        loanManager.connect(borrower).fundLoan(loanId)
      ).to.be.revertedWith("LoanManager: Borrower cannot fund their own loan");

      // 2. Non-existent loan funding rejected
      await expect(
        loanManager.connect(lender).fundLoan(999n)
      ).to.be.revertedWith("LoanManager: Loan does not exist");

      // 3. Direct call to LendingPool.transferFunds rejected
      await expect(
        lendingPool.connect(stranger).transferFunds(lender.address, borrower.address, p)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");

      // 4. Insufficient allowance atomicity test
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), 0n);

      await expect(
        loanManager.connect(lender).fundLoan(loanId)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientAllowance");

      // Atomicity verification: Loan remains REQUESTED, lender remains address(0), exposure unchanged
      let loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(0n); // Still REQUESTED
      expect(loan.lender).to.equal(ethers.ZeroAddress);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(p);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500n);

      // Restore allowance and fund properly
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), ethers.MaxUint256);
      await loanManager.connect(lender).fundLoan(loanId);
      expect((await loanManager.getLoan(loanId)).status).to.equal(1n); // ACTIVE
    });

    it("Verifies repayment attacks and failure atomicity", async function () {
      const p = 200n * ONE_USDC;
      const d = 10n * 86400n;

      await loanManager.connect(borrower).createLoan(p, 1000n, d);
      const loanId = 1n;
      await loanManager.connect(lender).fundLoan(loanId);

      // 1. Non-borrower repayment rejected
      await expect(
        loanManager.connect(lender).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Only the borrower can repay this loan");

      await expect(
        loanManager.connect(stranger).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Only the borrower can repay this loan");

      // 2. Insufficient allowance atomicity test
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), 0n);

      await expect(
        loanManager.connect(borrower).repayLoan(loanId)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientAllowance");

      // Atomicity verification: Loan remains ACTIVE, score unchanged, exposure unchanged
      let loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(1n); // Still ACTIVE
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(p);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500n);

      // Restore allowance and repay properly
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), ethers.MaxUint256);
      await loanManager.connect(borrower).repayLoan(loanId);
      expect((await loanManager.getLoan(loanId)).status).to.equal(2n); // REPAID
    });
  });

  // =========================================================================
  // REENTRANCY SECURITY
  // =========================================================================

  describe("Reentrancy Security Audit", function () {
    it("Prevents reentrancy attack against LoanManager.fundLoan and LendingPool.transferFunds", async function () {
      // Deploy MaliciousReentrantToken
      const MaliciousTokenFactory = await ethers.getContractFactory("MaliciousReentrantToken");
      const badToken = await MaliciousTokenFactory.deploy();

      // Deploy LendingPool pointing to badToken
      const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
      const testPool = await LendingPoolFactory.deploy(
        await badToken.getAddress(),
        owner.address
      );

      // Deploy LoanManager pointing to testPool
      const LoanManagerFactory = await ethers.getContractFactory("LoanManager");
      const testManager = await LoanManagerFactory.deploy(
        await creditRegistry.getAddress(),
        await testPool.getAddress(),
        owner.address
      );

      await testPool.connect(owner).setLoanManager(await testManager.getAddress());
      await creditRegistry.connect(owner).setLoanManager(await testManager.getAddress());

      // Provide tokens and approvals
      await badToken.transfer(lender.address, 10_000n * ONE_USDC);
      await badToken.connect(lender).approve(await testPool.getAddress(), ethers.MaxUint256);

      // Create loan
      await testManager.connect(borrower).createLoan(500n * ONE_USDC, 1000n, 10n * 86400n);
      const targetLoanId = 1n;

      // Configure reentrant attack on LoanManager.fundLoan
      await badToken.configureAttack(
        await testManager.getAddress(),
        await testPool.getAddress(),
        targetLoanId,
        lender.address,
        borrower.address,
        true,  // Attack LoanManager
        false
      );

      // Funding must revert with ReentrancyGuardReentrantCall
      await expect(
        testManager.connect(lender).fundLoan(targetLoanId)
      ).to.be.revertedWithCustomError(testManager, "ReentrancyGuardReentrantCall");
    });
  });

  // =========================================================================
  // ACCESS CONTROL & PRIVILEGED ADMIN AUDIT
  // =========================================================================

  describe("Access Control Audit across all 4 Contracts", function () {
    it("Strictly blocks unauthorized calls to all sensitive methods", async function () {
      // 1. CreditRegistry unauthorized mutation calls
      await expect(
        creditRegistry.connect(stranger).recordLoan(borrower.address, 100n * ONE_USDC)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");

      await expect(
        creditRegistry.connect(stranger).recordRepayment(borrower.address, 100n * ONE_USDC, true, true)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");

      await expect(
        creditRegistry.connect(stranger).recordDefault(borrower.address, 100n * ONE_USDC)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");

      await expect(
        creditRegistry.connect(stranger).setLoanManager(stranger.address)
      ).to.be.revertedWithCustomError(creditRegistry, "OwnableUnauthorizedAccount");

      // 2. LendingPool unauthorized calls
      await expect(
        lendingPool.connect(stranger).transferFunds(lender.address, borrower.address, 100n * ONE_USDC)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");

      await expect(
        lendingPool.connect(stranger).executeRepayment(borrower.address, lender.address, 100n * ONE_USDC)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");

      await expect(
        lendingPool.connect(stranger).setLoanManager(stranger.address)
      ).to.be.revertedWithCustomError(lendingPool, "OwnableUnauthorizedAccount");

      await expect(
        lendingPool.connect(stranger).setToken(stranger.address)
      ).to.be.revertedWithCustomError(lendingPool, "OwnableUnauthorizedAccount");

      // 3. LoanManager unauthorized admin calls
      await expect(
        loanManager.connect(stranger).setProtocolContracts(stranger.address, stranger.address)
      ).to.be.revertedWithCustomError(loanManager, "OwnableUnauthorizedAccount");

      await expect(
        loanManager.connect(stranger).setCreditRegistry(stranger.address)
      ).to.be.revertedWithCustomError(loanManager, "OwnableUnauthorizedAccount");

      await expect(
        loanManager.connect(stranger).setLendingPool(stranger.address)
      ).to.be.revertedWithCustomError(loanManager, "OwnableUnauthorizedAccount");
    });
  });

  // =========================================================================
  // ZERO ADDRESS & ZERO VALUE AUDIT
  // =========================================================================

  describe("Zero Address and Value Validation Audit", function () {
    it("Rejects zero addresses and invalid values across all methods", async function () {
      // Loan creation zero values
      await expect(
        loanManager.connect(borrower).createLoan(0n, 1000n, 86400n)
      ).to.be.revertedWith("LoanManager: Principal must be greater than zero");

      await expect(
        loanManager.connect(borrower).createLoan(100n * ONE_USDC, 1000n, 0n)
      ).to.be.revertedWith("LoanManager: Duration must be greater than zero");

      await expect(
        loanManager.connect(borrower).createLoan(100n * ONE_USDC, 0n, 86400n)
      ).to.be.revertedWith("LoanManager: Interest rate below minimum (1 bps)");

      // Faucet zero values
      await expect(
        mockUSDC.connect(borrower).faucet(ethers.ZeroAddress, 100n * ONE_USDC)
      ).to.be.revertedWith("MockUSDC: Zero address");

      await expect(
        mockUSDC.connect(borrower).faucet(borrower.address, 0n)
      ).to.be.revertedWith("MockUSDC: Zero amount");

      // CreditRegistry zero checks
      await expect(
        creditRegistry.connect(owner).setLoanManager(ethers.ZeroAddress)
      ).to.be.revertedWith("CreditRegistry: Invalid LoanManager address");

      // LendingPool zero checks
      await expect(
        lendingPool.connect(owner).setLoanManager(ethers.ZeroAddress)
      ).to.be.revertedWith("LendingPool: Invalid LoanManager address");

      await expect(
        lendingPool.connect(owner).setToken(ethers.ZeroAddress)
      ).to.be.revertedWith("LendingPool: Invalid token address");

      // LoanManager zero checks
      await expect(
        loanManager.connect(owner).setCreditRegistry(ethers.ZeroAddress)
      ).to.be.revertedWith("LoanManager: Invalid CreditRegistry");

      await expect(
        loanManager.connect(owner).setLendingPool(ethers.ZeroAddress)
      ).to.be.revertedWith("LoanManager: Invalid LendingPool");
    });
  });

  // =========================================================================
  // TIMESTAMP & GRACE PERIOD PRECISION TESTING
  // =========================================================================

  describe("Timestamp & Grace Period Precision Tests", function () {
    it("Verifies repayment classifications and default thresholds at exact seconds", async function () {
      const p = 100n * ONE_USDC;
      const duration = 2n * 86400n; // 2 days

      // Test Boundary 1: Exactly before dueDate (EARLY)
      await loanManager.connect(borrower).createLoan(p, 1000n, duration);
      await loanManager.connect(lender).fundLoan(1n);

      await loanManager.connect(borrower).repayLoan(1n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(570n); // +70 early

      // Test Boundary 2: Inside grace period (ON_TIME)
      await loanManager.connect(borrower).createLoan(p, 1000n, duration);
      await loanManager.connect(lender).fundLoan(2n);

      // Increase time to dueDate + 12 hours (safely inside the 24-hour grace period)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 12 * 3600]);
      await ethers.provider.send("evm_mine");

      await loanManager.connect(borrower).repayLoan(2n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(620n); // 570 + 50 = 620

      // Test Boundary 3: Exactly past grace period (LATE & default enabled)
      await loanManager.connect(borrower).createLoan(p, 1000n, duration);
      await loanManager.connect(lender).fundLoan(3n);

      // Increase time past dueDate + grace period + 10s
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      // markDefault is now allowed
      await expect(loanManager.connect(stranger).markDefault(3n)).to.not.be.reverted;
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(470n); // 620 - 150 = 470
    });
  });

  // =========================================================================
  // DETERMINISTIC INVARIANTS (INVARIANTS 1 - 12)
  // =========================================================================

  describe("Protocol Invariant Verification (1-12)", function () {
    it("Invariant 1: LoanManager cannot create exposure > availableBorrowingPower", async function () {
      const limit = await creditRegistry.getBorrowingLimit(borrower.address);
      await expect(
        loanManager.connect(borrower).createLoan(limit + 1n, 1000n, 86400n)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");
    });

    it("Invariant 2: A loan can only be funded once", async function () {
      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, 1000n, 86400n);
      await loanManager.connect(lender).fundLoan(1n);

      await expect(
        loanManager.connect(lender).fundLoan(1n)
      ).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");
    });

    it("Invariant 3: A loan can only be repaid once", async function () {
      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, 1000n, 86400n);
      await loanManager.connect(lender).fundLoan(1n);
      await loanManager.connect(borrower).repayLoan(1n);

      await expect(
        loanManager.connect(borrower).repayLoan(1n)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("Invariant 4: A loan can only default once", async function () {
      const d = 86400n;
      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, 1000n, d);
      await loanManager.connect(lender).fundLoan(1n);

      await ethers.provider.send("evm_increaseTime", [Number(d) + 86400 + 10]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(1n);

      await expect(
        loanManager.connect(stranger).markDefault(1n)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("Invariant 5 & 6: REQUESTED + ACTIVE equals outstanding exposure; REPAID/DEFAULTED release it", async function () {
      const d = 86400n;
      await loanManager.connect(borrower).createLoan(150n * ONE_USDC, 1000n, d);
      await loanManager.connect(borrower).createLoan(250n * ONE_USDC, 1000n, d);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(400n * ONE_USDC);

      // Fund loan 1 (now ACTIVE, loan 2 still REQUESTED)
      await loanManager.connect(lender).fundLoan(1n);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(400n * ONE_USDC);

      // Repay loan 1 (REPAID) -> drops to 250 USDC
      await loanManager.connect(borrower).repayLoan(1n);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(250n * ONE_USDC);

      // Fund loan 2 and default it -> drops to 0 USDC
      await loanManager.connect(lender).fundLoan(2n);
      await ethers.provider.send("evm_increaseTime", [Number(d) + 86400 + 10]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(2n);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
    });

    it("Invariant 7: Credit score remains strictly within [300, 850]", async function () {
      expect(await creditRegistry.MIN_SCORE()).to.equal(300n);
      expect(await creditRegistry.MAX_SCORE()).to.equal(850n);
    });

    it("Invariant 8: No unauthorized account can mutate credit history", async function () {
      await expect(
        creditRegistry.connect(stranger).recordLoan(stranger.address, 100n * ONE_USDC)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");
    });

    it("Invariant 9: No unauthorized account can move tokens through LendingPool", async function () {
      await expect(
        lendingPool.connect(stranger).transferFunds(lender.address, borrower.address, 100n * ONE_USDC)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");
    });

    it("Invariant 10 & 11: Exact token amounts are transferred upon funding and repayment", async function () {
      const p = 500n * ONE_USDC;
      const d = 30n * 86400n;
      const r = 550n; // 5.5% -> expected totalDue = 502,260,273 base units

      await loanManager.connect(borrower).createLoan(p, r, d);
      const loan = await loanManager.getLoan(1n);
      expect(loan.totalDue).to.equal(502_260_273n);

      const bBal0 = await mockUSDC.balanceOf(borrower.address);
      const lBal0 = await mockUSDC.balanceOf(lender.address);

      await loanManager.connect(lender).fundLoan(1n);
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(bBal0 + p);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lBal0 - p);

      await loanManager.connect(borrower).repayLoan(1n);
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(bBal0 + p - 502_260_273n);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lBal0 - p + 502_260_273n);
    });

    it("Invariant 12: A failed transaction does not partially update protocol state", async function () {
      // Insufficient allowance on repayment reverts and leaves state ACTIVE and score unchanged
      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, 1000n, 86400n);
      await loanManager.connect(lender).fundLoan(1n);

      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), 0n);

      await expect(
        loanManager.connect(borrower).repayLoan(1n)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientAllowance");

      expect((await loanManager.getLoan(1n)).status).to.equal(1n); // ACTIVE
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(500n);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(100n * ONE_USDC);
    });
  });
});
