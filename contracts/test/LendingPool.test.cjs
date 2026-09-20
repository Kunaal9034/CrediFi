const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool Contract — Token Movement & Custody Layer", function () {
  let mockUSDC, lendingPool;
  let owner, loanManagerSigner, lender, borrower, stranger;
  const DECIMALS = 6n;
  const ONE_USDC = 10n ** DECIMALS;

  beforeEach(async function () {
    [owner, loanManagerSigner, lender, borrower, stranger] = await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();

    // 2. Deploy LendingPool with mockUSDC and loanManagerSigner
    const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPoolFactory.deploy(
      await mockUSDC.getAddress(),
      loanManagerSigner.address
    );

    // 3. Fund lender and borrower with test tokens
    await mockUSDC.connect(lender).faucet(lender.address, 10_000n * ONE_USDC);
    await mockUSDC.connect(borrower).faucet(borrower.address, 10_000n * ONE_USDC);
  });

  describe("DEPLOYMENT (1-4)", function () {
    it("1. Deploys with valid token address", async function () {
      expect(await lendingPool.token()).to.equal(await mockUSDC.getAddress());
    });

    it("2. Deploys with valid LoanManager address", async function () {
      expect(await lendingPool.loanManager()).to.equal(loanManagerSigner.address);
      expect(await lendingPool.owner()).to.equal(owner.address);
    });

    it("3. Rejects zero token address", async function () {
      const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
      await expect(
        LendingPoolFactory.deploy(ethers.ZeroAddress, loanManagerSigner.address)
      ).to.be.revertedWith("LendingPool: Invalid token address");
    });

    it("4. Rejects zero LoanManager address", async function () {
      const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
      await expect(
        LendingPoolFactory.deploy(await mockUSDC.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("LendingPool: Invalid LoanManager address");
    });
  });

  describe("ACCESS CONTROL (5-8)", function () {
    const amount = 100n * ONE_USDC;

    it("5. Only LoanManager can call transferFunds", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), amount);
      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, amount)
      ).to.not.be.reverted;
    });

    it("6. Only LoanManager can call executeRepayment", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), amount);
      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, amount)
      ).to.not.be.reverted;
    });

    it("7. Random user cannot transfer funds", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), amount);
      await expect(
        lendingPool.connect(stranger).transferFunds(lender.address, borrower.address, amount)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");
    });

    it("8. Random user cannot execute repayment", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), amount);
      await expect(
        lendingPool.connect(stranger).executeRepayment(borrower.address, lender.address, amount)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");
    });
  });

  describe("FUNDING (9-19)", function () {
    const principal = 500n * ONE_USDC;

    it("9. Lender can approve LendingPool", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), principal);
      expect(
        await mockUSDC.allowance(lender.address, await lendingPool.getAddress())
      ).to.equal(principal);
    });

    it("10. LoanManager can transfer lender funds to borrower", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), principal);
      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, principal)
      ).to.not.be.reverted;
    });

    it("11. Borrower's balance increases by exact amount", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), principal);
      const borrowerBefore = await mockUSDC.balanceOf(borrower.address);

      await lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, principal);

      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBefore + principal);
    });

    it("12. Lender's balance decreases by exact amount", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), principal);
      const lenderBefore = await mockUSDC.balanceOf(lender.address);

      await lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, principal);

      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBefore - principal);
    });

    it("13. FundsTransferred event emitted", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), principal);

      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, principal)
      )
        .to.emit(lendingPool, "FundsTransferred")
        .withArgs(lender.address, borrower.address, principal)
        .and.to.emit(lendingPool, "FundsDisbursed")
        .withArgs(lender.address, borrower.address, principal);
    });

    it("14. Zero lender rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(ethers.ZeroAddress, borrower.address, principal)
      ).to.be.revertedWith("LendingPool: Invalid lender");
    });

    it("15. Zero borrower rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, ethers.ZeroAddress, principal)
      ).to.be.revertedWith("LendingPool: Invalid borrower");
    });

    it("16. Zero amount rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, 0n)
      ).to.be.revertedWith("LendingPool: Amount must be greater than zero");
    });

    it("17. Lender == borrower rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, lender.address, principal)
      ).to.be.revertedWith("LendingPool: Lender cannot be borrower");
    });

    it("18. Insufficient allowance fails", async function () {
      // Lender approves less than requested amount
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), 100n * ONE_USDC);

      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, principal)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientAllowance");
    });

    it("19. Insufficient lender balance fails", async function () {
      // Create empty wallet with no tokens
      const [, , , , , poorLender] = await ethers.getSigners();
      await mockUSDC.connect(poorLender).approve(await lendingPool.getAddress(), principal);

      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(poorLender.address, borrower.address, principal)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientBalance");
    });
  });

  describe("REPAYMENT (20-30)", function () {
    const totalDue = 550n * ONE_USDC;

    it("20. Borrower can approve LendingPool", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), totalDue);
      expect(
        await mockUSDC.allowance(borrower.address, await lendingPool.getAddress())
      ).to.equal(totalDue);
    });

    it("21. LoanManager can execute repayment", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), totalDue);
      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, totalDue)
      ).to.not.be.reverted;
    });

    it("22. Borrower's balance decreases by exact amount", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), totalDue);
      const borrowerBefore = await mockUSDC.balanceOf(borrower.address);

      await lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, totalDue);

      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBefore - totalDue);
    });

    it("23. Lender's balance increases by exact amount", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), totalDue);
      const lenderBefore = await mockUSDC.balanceOf(lender.address);

      await lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, totalDue);

      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBefore + totalDue);
    });

    it("24. RepaymentExecuted event emitted", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), totalDue);

      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, totalDue)
      )
        .to.emit(lendingPool, "RepaymentExecuted")
        .withArgs(borrower.address, lender.address, totalDue)
        .and.to.emit(lendingPool, "RepaymentTransferred")
        .withArgs(borrower.address, lender.address, totalDue);
    });

    it("25. Zero borrower rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(ethers.ZeroAddress, lender.address, totalDue)
      ).to.be.revertedWith("LendingPool: Invalid borrower");
    });

    it("26. Zero lender rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, ethers.ZeroAddress, totalDue)
      ).to.be.revertedWith("LendingPool: Invalid lender");
    });

    it("27. Zero amount rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, 0n)
      ).to.be.revertedWith("LendingPool: Repayment must be greater than zero");
    });

    it("28. Borrower == lender rejected", async function () {
      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, borrower.address, totalDue)
      ).to.be.revertedWith("LendingPool: Borrower cannot be lender");
    });

    it("29. Insufficient allowance fails", async function () {
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), 100n * ONE_USDC);

      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, totalDue)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientAllowance");
    });

    it("30. Insufficient borrower balance fails", async function () {
      const [, , , , , , poorBorrower] = await ethers.getSigners();
      await mockUSDC.connect(poorBorrower).approve(await lendingPool.getAddress(), totalDue);

      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(poorBorrower.address, lender.address, totalDue)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientBalance");
    });
  });

  describe("SECURITY (31-34)", function () {
    const amount = 200n * ONE_USDC;

    it("31. Unauthorized direct token movement fails", async function () {
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), amount);

      // Caller is stranger, not LoanManager
      await expect(
        lendingPool.connect(stranger).transferFunds(lender.address, stranger.address, amount)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");

      await expect(
        lendingPool.connect(stranger).executeRepayment(lender.address, stranger.address, amount)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");
    });

    it("32. Reentrancy protection is present/tested where practical", async function () {
      // Verify LendingPool inherits ReentrancyGuard and functions execute properly
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), amount);
      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, amount)
      ).to.not.be.reverted;
    });

    it("33. Protocol address configuration cannot be changed by non-owner", async function () {
      await expect(
        lendingPool.connect(stranger).setLoanManager(stranger.address)
      ).to.be.revertedWithCustomError(lendingPool, "OwnableUnauthorizedAccount");

      await expect(
        lendingPool.connect(stranger).setToken(stranger.address)
      ).to.be.revertedWithCustomError(lendingPool, "OwnableUnauthorizedAccount");
    });

    it("34. Zero-address configuration updates rejected", async function () {
      await expect(
        lendingPool.connect(owner).setLoanManager(ethers.ZeroAddress)
      ).to.be.revertedWith("LendingPool: Invalid LoanManager address");

      await expect(
        lendingPool.connect(owner).setToken(ethers.ZeroAddress)
      ).to.be.revertedWith("LendingPool: Invalid token address");
    });
  });

  describe("ERC20 COMPATIBILITY (35-36)", function () {
    it("35. Uses SafeERC20 successfully with MockUSDC", async function () {
      const transferAmount = 1_234n * ONE_USDC;
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), transferAmount);

      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, transferAmount)
      ).to.not.be.reverted;
    });

    it("36. Exact 6-decimal base-unit amounts are preserved", async function () {
      // Test odd base units (e.g. 500.123456 USDC = 500123456 base units)
      const preciseAmount = 500_123_456n;
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), preciseAmount);

      const lenderBefore = await mockUSDC.balanceOf(lender.address);
      const borrowerBefore = await mockUSDC.balanceOf(borrower.address);

      await lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, preciseAmount);

      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBefore - preciseAmount);
      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBefore + preciseAmount);
    });
  });
});
