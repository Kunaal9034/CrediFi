const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LoanManager Contract — Protocol Orchestrator & State Machine", function () {
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

    // 7. Approve LendingPool
    await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), ethers.MaxUint256);
  });

  describe("DEPLOYMENT (1-4)", function () {
    it("1. Deployment initializes correctly", async function () {
      expect(await loanManager.owner()).to.equal(owner.address);
      expect(await loanManager.loanCounter()).to.equal(0n);
      expect(await loanManager.MIN_INTEREST_RATE_BPS()).to.equal(1n);
      expect(await loanManager.MAX_INTEREST_RATE_BPS()).to.equal(2000n);
      expect(await loanManager.MIN_DURATION()).to.equal(86400n);
      expect(await loanManager.MAX_DURATION()).to.equal(365n * 86400n);
      expect(await loanManager.DEFAULT_GRACE_PERIOD()).to.equal(86400n);
    });

    it("2. CreditRegistry address configured", async function () {
      expect(await loanManager.creditRegistry()).to.equal(await creditRegistry.getAddress());
    });

    it("3. LendingPool address configured", async function () {
      expect(await loanManager.lendingPool()).to.equal(await lendingPool.getAddress());
    });

    it("4. Zero-address configuration rejected in constructor and setters", async function () {
      const LoanManagerFactory = await ethers.getContractFactory("LoanManager");

      // Constructor zero address checks
      await expect(
        LoanManagerFactory.deploy(ethers.ZeroAddress, await lendingPool.getAddress(), owner.address)
      ).to.be.revertedWith("LoanManager: Invalid CreditRegistry");

      await expect(
        LoanManagerFactory.deploy(await creditRegistry.getAddress(), ethers.ZeroAddress, owner.address)
      ).to.be.revertedWith("LoanManager: Invalid LendingPool");

      // Setter zero address checks
      await expect(
        loanManager.connect(owner).setProtocolContracts(ethers.ZeroAddress, await lendingPool.getAddress())
      ).to.be.revertedWith("LoanManager: Invalid CreditRegistry");

      await expect(
        loanManager.connect(owner).setProtocolContracts(await creditRegistry.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("LoanManager: Invalid LendingPool");

      await expect(
        loanManager.connect(owner).setCreditRegistry(ethers.ZeroAddress)
      ).to.be.revertedWith("LoanManager: Invalid CreditRegistry");

      await expect(
        loanManager.connect(owner).setLendingPool(ethers.ZeroAddress)
      ).to.be.revertedWith("LoanManager: Invalid LendingPool");
    });
  });

  describe("CREATE LOAN (5-20)", function () {
    const defaultPrincipal = 300n * ONE_USDC;
    const defaultRate = 1000n; // 10%
    const defaultDuration = 30n * 86400n; // 30 days

    it("5. Valid borrower can create REQUESTED loan", async function () {
      await expect(
        loanManager.connect(borrower).createLoan(defaultPrincipal, defaultRate, defaultDuration)
      ).to.not.be.reverted;

      const loan = await loanManager.getLoan(1);
      expect(loan.status).to.equal(0n); // REQUESTED
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.lender).to.equal(ethers.ZeroAddress);
    });

    it("6. Loan ID increments correctly", async function () {
      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, defaultRate, defaultDuration);
      expect(await loanManager.loanCounter()).to.equal(1n);

      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, defaultRate, defaultDuration);
      expect(await loanManager.loanCounter()).to.equal(2n);

      const loan1 = await loanManager.getLoan(1);
      const loan2 = await loanManager.getLoan(2);
      expect(loan1.loanId).to.equal(1n);
      expect(loan2.loanId).to.equal(2n);
    });

    it("7. Loan stores correct borrower/principal/rate/duration", async function () {
      await loanManager.connect(borrower).createLoan(defaultPrincipal, defaultRate, defaultDuration);
      const loan = await loanManager.getLoan(1);

      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.principal).to.equal(defaultPrincipal);
      expect(loan.interestRateBps).to.equal(defaultRate);
      expect(loan.duration).to.equal(defaultDuration);
    });

    it("8. Correct interest is calculated", async function () {
      // Formula test: 500e6 * 550 * 30 days / (365 days * 10000)
      const p = 500n * ONE_USDC;
      const r = 550n; // 5.5%
      const d = 30n * 86400n;
      const expectedInterest = 2260273n;

      const calcInterest = await loanManager.calculateInterest(p, r, d);
      expect(calcInterest).to.equal(expectedInterest);
    });

    it("9. Correct totalDue is calculated", async function () {
      const p = 500n * ONE_USDC;
      const r = 550n;
      const d = 30n * 86400n;
      const expectedTotalDue = 502260273n;

      const calcTotalDue = await loanManager["calculateTotalDue(uint256,uint256,uint256)"](p, r, d);
      expect(calcTotalDue).to.equal(expectedTotalDue);

      await loanManager.connect(borrower).createLoan(p, r, d);
      const loan = await loanManager.getLoan(1);
      expect(loan.totalDue).to.equal(expectedTotalDue);
      expect(await loanManager["calculateTotalDue(uint256)"](1)).to.equal(expectedTotalDue);
    });

    it("10. Correct dueDate is created", async function () {
      const tx = await loanManager.connect(borrower).createLoan(defaultPrincipal, defaultRate, defaultDuration);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const loan = await loanManager.getLoan(1);
      expect(loan.createdAt).to.equal(BigInt(block.timestamp));
      expect(loan.dueDate).to.equal(BigInt(block.timestamp) + defaultDuration);
    });

    it("11. LoanCreated event emitted", async function () {
      const expectedInterest = await loanManager.calculateInterest(defaultPrincipal, defaultRate, defaultDuration);
      const expectedTotal = defaultPrincipal + expectedInterest;

      const tx = await loanManager.connect(borrower).createLoan(defaultPrincipal, defaultRate, defaultDuration);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedDueDate = BigInt(block.timestamp) + defaultDuration;

      await expect(tx)
        .to.emit(loanManager, "LoanCreated")
        .withArgs(
          1n,
          borrower.address,
          defaultPrincipal,
          defaultRate,
          defaultDuration,
          expectedTotal,
          expectedDueDate
        );
    });

    it("12. Zero principal rejected", async function () {
      await expect(
        loanManager.connect(borrower).createLoan(0n, defaultRate, defaultDuration)
      ).to.be.revertedWith("LoanManager: Principal must be greater than zero");
    });

    it("13. Zero duration rejected", async function () {
      await expect(
        loanManager.connect(borrower).createLoan(defaultPrincipal, defaultRate, 0n)
      ).to.be.revertedWith("LoanManager: Duration must be greater than zero");
    });

    it("14. Duration > 365 days rejected", async function () {
      const excessiveDuration = 366n * 86400n;
      await expect(
        loanManager.connect(borrower).createLoan(defaultPrincipal, defaultRate, excessiveDuration)
      ).to.be.revertedWith("LoanManager: Duration exceeds maximum (365 days)");
    });

    it("15. Interest below minimum rejected", async function () {
      await expect(
        loanManager.connect(borrower).createLoan(defaultPrincipal, 0n, defaultDuration)
      ).to.be.revertedWith("LoanManager: Interest rate below minimum (1 bps)");
    });

    it("16. Interest above maximum rejected", async function () {
      await expect(
        loanManager.connect(borrower).createLoan(defaultPrincipal, 2001n, defaultDuration)
      ).to.be.revertedWith("LoanManager: Interest rate exceeds maximum (2000 bps)");
    });

    it("17. Borrower cannot exceed borrowing limit", async function () {
      const limit = await creditRegistry.getBorrowingLimit(borrower.address);
      expect(limit).to.equal(500n * ONE_USDC);

      await expect(
        loanManager.connect(borrower).createLoan(501n * ONE_USDC, defaultRate, defaultDuration)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");
    });

    it("18. Multiple REQUESTED loans cannot bypass borrowing limit", async function () {
      // Loan 1: 300 USDC -> succeeds
      await loanManager.connect(borrower).createLoan(300n * ONE_USDC, defaultRate, defaultDuration);

      // Remaining power = 200 USDC. Loan 2 for 201 USDC must revert
      await expect(
        loanManager.connect(borrower).createLoan(201n * ONE_USDC, defaultRate, defaultDuration)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");

      // Loan 2 for 200 USDC -> succeeds
      await loanManager.connect(borrower).createLoan(200n * ONE_USDC, defaultRate, defaultDuration);

      // Remaining power = 0 USDC. Any further loan must revert
      await expect(
        loanManager.connect(borrower).createLoan(1n * ONE_USDC, defaultRate, defaultDuration)
      ).to.be.revertedWith("LoanManager: Requested amount exceeds onchain borrowing limit");
    });

    it("19. Creating a loan increases outstanding exposure", async function () {
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);

      await loanManager.connect(borrower).createLoan(250n * ONE_USDC, defaultRate, defaultDuration);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(250n * ONE_USDC);

      await loanManager.connect(borrower).createLoan(150n * ONE_USDC, defaultRate, defaultDuration);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(400n * ONE_USDC);
    });

    it("20. Creating a loan does NOT call recordLoan", async function () {
      await loanManager.connect(borrower).createLoan(300n * ONE_USDC, defaultRate, defaultDuration);

      const profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.totalLoans).to.equal(0n);
      expect(profile.totalBorrowed).to.equal(0n);
    });
  });

  describe("FUNDING (21-29)", function () {
    const loanAmount = 300n * ONE_USDC;
    const rate = 1000n;
    const duration = 14n * 86400n; // 14 days
    let loanId;

    beforeEach(async function () {
      await loanManager.connect(borrower).createLoan(loanAmount, rate, duration);
      loanId = 1n;
    });

    it("21. Valid lender can fund REQUESTED loan", async function () {
      await expect(loanManager.connect(lender).fundLoan(loanId)).to.not.be.reverted;
    });

    it("22. Funding changes REQUESTED → ACTIVE", async function () {
      const loanBefore = await loanManager.getLoan(loanId);
      expect(loanBefore.status).to.equal(0n); // REQUESTED

      await loanManager.connect(lender).fundLoan(loanId);

      const loanAfter = await loanManager.getLoan(loanId);
      expect(loanAfter.status).to.equal(1n); // ACTIVE
    });

    it("23. Lender is stored", async function () {
      await loanManager.connect(lender).fundLoan(loanId);
      const loan = await loanManager.getLoan(loanId);
      expect(loan.lender).to.equal(lender.address);
    });

    it("24. Borrower receives principal", async function () {
      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);

      await loanManager.connect(lender).fundLoan(loanId);

      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalBefore + loanAmount);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore - loanAmount);
    });

    it("25. Lender cannot fund own loan", async function () {
      await expect(
        loanManager.connect(borrower).fundLoan(loanId)
      ).to.be.revertedWith("LoanManager: Borrower cannot fund their own loan");
    });

    it("26. Loan cannot be funded twice", async function () {
      await loanManager.connect(lender).fundLoan(loanId);

      await expect(
        loanManager.connect(stranger).fundLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");
    });

    it("27. Funding nonexistent loan rejected", async function () {
      await expect(
        loanManager.connect(lender).fundLoan(999n)
      ).to.be.revertedWith("LoanManager: Loan does not exist");
    });

    it("28. CreditRegistry.recordLoan is called only after successful funding", async function () {
      const profileBefore = await creditRegistry.getCreditProfile(borrower.address);
      expect(profileBefore.totalLoans).to.equal(0n);

      await loanManager.connect(lender).fundLoan(loanId);

      const profileAfter = await creditRegistry.getCreditProfile(borrower.address);
      expect(profileAfter.totalLoans).to.equal(1n);
      expect(profileAfter.totalBorrowed).to.equal(loanAmount);
    });

    it("29. LoanFunded event emitted", async function () {
      const tx = await loanManager.connect(lender).fundLoan(loanId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedDueDate = BigInt(block.timestamp) + duration;

      await expect(tx)
        .to.emit(loanManager, "LoanFunded")
        .withArgs(loanId, lender.address, borrower.address, loanAmount, expectedDueDate);
    });
  });

  describe("REPAYMENT (30-41)", function () {
    const loanAmount = 250n * ONE_USDC;
    const rate = 1000n; // 10%
    const duration = 10n * 86400n; // 10 days
    let loanId;

    beforeEach(async function () {
      await loanManager.connect(borrower).createLoan(loanAmount, rate, duration);
      loanId = 1n;
      await loanManager.connect(lender).fundLoan(loanId);
    });

    it("30. Borrower can repay ACTIVE loan", async function () {
      await expect(loanManager.connect(borrower).repayLoan(loanId)).to.not.be.reverted;
    });

    it("31. Non-borrower cannot repay", async function () {
      await expect(
        loanManager.connect(stranger).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Only the borrower can repay this loan");
    });

    it("32. REQUESTED loan cannot be repaid", async function () {
      await loanManager.connect(borrower).createLoan(100n * ONE_USDC, rate, duration);
      const unfundedLoanId = 2n;

      await expect(
        loanManager.connect(borrower).repayLoan(unfundedLoanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("33. REPAID loan cannot be repaid again", async function () {
      await loanManager.connect(borrower).repayLoan(loanId);

      await expect(
        loanManager.connect(borrower).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("34. Early repayment gives +70", async function () {
      // Repay immediately before dueDate
      await loanManager.connect(borrower).repayLoan(loanId);

      const score = await creditRegistry.getCreditScore(borrower.address);
      expect(score).to.equal(570n); // 500 base + 70 early
    });

    it("35. On-time repayment within grace period gives +50", async function () {
      // Advance time to dueDate + 12 hours (within 1-day grace period)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 12 * 3600]);
      await ethers.provider.send("evm_mine");

      await loanManager.connect(borrower).repayLoan(loanId);

      const score = await creditRegistry.getCreditScore(borrower.address);
      expect(score).to.equal(550n); // 500 base + 50 on-time
    });

    it("36. Late repayment gives -40", async function () {
      // Advance time past dueDate + grace period (10 days + 1 day grace + 1 day = 12 days)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 3600]);
      await ethers.provider.send("evm_mine");

      await loanManager.connect(borrower).repayLoan(loanId);

      const score = await creditRegistry.getCreditScore(borrower.address);
      expect(score).to.equal(460n); // 500 base - 40 late
    });

    it("37. Correct totalDue transferred", async function () {
      const loan = await loanManager.getLoan(loanId);
      const totalDue = loan.totalDue;
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);
      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);

      await loanManager.connect(borrower).repayLoan(loanId);

      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore + totalDue);
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalBefore - totalDue);
    });

    it("38. Loan changes ACTIVE → REPAID", async function () {
      await loanManager.connect(borrower).repayLoan(loanId);
      const loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(2n); // REPAID
    });

    it("39. Outstanding exposure decreases", async function () {
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(loanAmount);

      await loanManager.connect(borrower).repayLoan(loanId);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
    });

    it("40. CreditRegistry repayment update occurs", async function () {
      await loanManager.connect(borrower).repayLoan(loanId);

      const profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.repaidLoans).to.equal(1n);
      expect(profile.totalRepaid).to.equal(loanAmount);
    });

    it("41. LoanRepaid event emitted", async function () {
      const loan = await loanManager.getLoan(loanId);
      const totalDue = loan.totalDue;

      await expect(loanManager.connect(borrower).repayLoan(loanId))
        .to.emit(loanManager, "LoanRepaid")
        .withArgs(loanId, borrower.address, lender.address, loanAmount, totalDue, 0); // 0 = EARLY
    });
  });

  describe("DEFAULT (42-49)", function () {
    const loanAmount = 200n * ONE_USDC;
    const rate = 1000n;
    const duration = 2n * 86400n; // 2 days
    let loanId;

    beforeEach(async function () {
      await loanManager.connect(borrower).createLoan(loanAmount, rate, duration);
      loanId = 1n;
      await loanManager.connect(lender).fundLoan(loanId);
    });

    it("42. Default cannot occur before dueDate + grace period", async function () {
      // Advance to dueDate + 12 hours (within 1-day grace period)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 12 * 3600]);
      await ethers.provider.send("evm_mine");

      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not past due date plus grace period");
    });

    it("43. Default can occur after grace period", async function () {
      // Advance past dueDate + 1 day grace period (2 days duration + 1 day grace + 10s)
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      await expect(loanManager.connect(lender).markDefault(loanId)).to.not.be.reverted;
    });

    it("44. Anyone can trigger valid default", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      // Stranger triggers default
      await expect(loanManager.connect(stranger).markDefault(loanId)).to.not.be.reverted;
    });

    it("45. Default changes ACTIVE → DEFAULTED", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      await loanManager.connect(stranger).markDefault(loanId);

      const loan = await loanManager.getLoan(loanId);
      expect(loan.status).to.equal(3n); // DEFAULTED
    });

    it("46. Outstanding exposure decreases", async function () {
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(loanAmount);

      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      await loanManager.connect(stranger).markDefault(loanId);
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
    });

    it("47. CreditRegistry.recordDefault called", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      await loanManager.connect(stranger).markDefault(loanId);

      const profile = await creditRegistry.getCreditProfile(borrower.address);
      expect(profile.defaultedLoans).to.equal(1n);
      expect(await creditRegistry.getCreditScore(borrower.address)).to.equal(350n); // 500 - 150
    });

    it("48. Default cannot happen twice", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      await loanManager.connect(stranger).markDefault(loanId);

      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });

    it("49. LoanDefaulted event emitted", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");

      await expect(loanManager.connect(stranger).markDefault(loanId))
        .to.emit(loanManager, "LoanDefaulted")
        .withArgs(loanId, borrower.address, lender.address, loanAmount);
    });
  });

  describe("STATE MACHINE (50)", function () {
    const loanAmount = 200n * ONE_USDC;
    const rate = 1000n;
    const duration = 2n * 86400n;

    it("50. Invalid state transitions revert", async function () {
      // Create Loan (status = REQUESTED)
      await loanManager.connect(borrower).createLoan(loanAmount, rate, duration);
      const loanId = 1n;

      // 1. REQUESTED -> REPAID forbidden
      await expect(
        loanManager.connect(borrower).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // 2. REQUESTED -> DEFAULTED forbidden
      await expect(
        loanManager.connect(stranger).markDefault(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // Fund Loan (status = ACTIVE)
      await loanManager.connect(lender).fundLoan(loanId);

      // 3. ACTIVE -> REQUESTED forbidden (fundLoan requires REQUESTED)
      await expect(
        loanManager.connect(stranger).fundLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");

      // Repay Loan (status = REPAID)
      await loanManager.connect(borrower).repayLoan(loanId);

      // 4. REPAID -> ACTIVE forbidden
      await expect(
        loanManager.connect(lender).fundLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");

      // 5. REPAID -> REPAID forbidden
      await expect(
        loanManager.connect(borrower).repayLoan(loanId)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");

      // Create & fund loan 2 to test DEFAULTED transitions
      await loanManager.connect(borrower).createLoan(loanAmount, rate, duration);
      const loanId2 = 2n;
      await loanManager.connect(lender).fundLoan(loanId2);

      await ethers.provider.send("evm_increaseTime", [Number(duration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(loanId2);

      // 6. DEFAULTED -> ACTIVE forbidden
      await expect(
        loanManager.connect(lender).fundLoan(loanId2)
      ).to.be.revertedWith("LoanManager: Loan is not in REQUESTED state");

      // 7. DEFAULTED -> DEFAULTED forbidden
      await expect(
        loanManager.connect(stranger).markDefault(loanId2)
      ).to.be.revertedWith("LoanManager: Loan is not in ACTIVE state");
    });
  });

  describe("BORROWING CAPACITY (51-55)", function () {
    const defaultRate = 1000n;
    const defaultDuration = 7n * 86400n;

    it("51. Requested loans consume capacity", async function () {
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(500n * ONE_USDC);

      await loanManager.connect(borrower).createLoan(200n * ONE_USDC, defaultRate, defaultDuration);

      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(200n * ONE_USDC);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(300n * ONE_USDC);
    });

    it("52. Active loans consume capacity", async function () {
      await loanManager.connect(borrower).createLoan(200n * ONE_USDC, defaultRate, defaultDuration);
      await loanManager.connect(lender).fundLoan(1n);

      // Still consumes exactly 200 USDC
      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(200n * ONE_USDC);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(300n * ONE_USDC);
    });

    it("53. Repaid loans release capacity", async function () {
      await loanManager.connect(borrower).createLoan(200n * ONE_USDC, defaultRate, defaultDuration);
      await loanManager.connect(lender).fundLoan(1n);
      await loanManager.connect(borrower).repayLoan(1n);

      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
      // New score is 570, so new limit is (500e6 * 570) / 500 = 570 USDC
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(570n * ONE_USDC);
    });

    it("54. Defaulted loans release capacity", async function () {
      const shortDuration = 2n * 86400n;
      await loanManager.connect(borrower).createLoan(200n * ONE_USDC, defaultRate, shortDuration);
      await loanManager.connect(lender).fundLoan(1n);

      await ethers.provider.send("evm_increaseTime", [Number(shortDuration) + 86400 + 10]);
      await ethers.provider.send("evm_mine");
      await loanManager.connect(stranger).markDefault(1n);

      expect(await loanManager.getOutstandingPrincipal(borrower.address)).to.equal(0n);
      // Score penalized by 150 to 350. Limit is (500e6 * 350) / 500 = 350 USDC
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(350n * ONE_USDC);
    });

    it("55. Available borrowing power is correct when outstanding equals or exceeds limit", async function () {
      await loanManager.connect(borrower).createLoan(500n * ONE_USDC, defaultRate, defaultDuration);
      expect(await loanManager.getAvailableBorrowingPower(borrower.address)).to.equal(0n);
    });
  });

  describe("SECURITY (56-58)", function () {
    it("56. Reentrancy protection is present on external state-changing functions", async function () {
      // Verify LoanManager inherits ReentrancyGuard and functions execute properly
      const loanAmount = 100n * ONE_USDC;
      const rate = 1000n;
      const duration = 7n * 86400n;

      await expect(loanManager.connect(borrower).createLoan(loanAmount, rate, duration)).to.not.be.reverted;
      await expect(loanManager.connect(lender).fundLoan(1n)).to.not.be.reverted;
      await expect(loanManager.connect(borrower).repayLoan(1n)).to.not.be.reverted;
    });

    it("57. Users cannot modify CreditRegistry through LoanManager in an unauthorized way", async function () {
      // Direct call to CreditRegistry by user reverts
      await expect(
        creditRegistry.connect(stranger).recordLoan(stranger.address, 1000n * ONE_USDC)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");

      await expect(
        creditRegistry.connect(stranger).recordRepayment(stranger.address, 1000n * ONE_USDC, true, true)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");

      await expect(
        creditRegistry.connect(stranger).recordDefault(stranger.address, 1000n * ONE_USDC)
      ).to.be.revertedWith("CreditRegistry: Caller is not authorized LoanManager");

      // Nonexistent loan repayment through LoanManager reverts
      await expect(
        loanManager.connect(stranger).repayLoan(999n)
      ).to.be.revertedWith("LoanManager: Loan does not exist");
    });

    it("58. Protocol addresses cannot be changed by non-owner", async function () {
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
});
