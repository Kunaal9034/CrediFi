const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool Contract", function () {
  let mockUSDC, lendingPool;
  let owner, loanManagerSigner, lender, borrower, stranger;
  const DECIMALS = 6n;
  const ONE_USDC = 10n ** DECIMALS;

  beforeEach(async function () {
    [owner, loanManagerSigner, lender, borrower, stranger] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();

    const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPoolFactory.deploy(await mockUSDC.getAddress(), owner.address);

    // Authorize loanManagerSigner as loanManager
    await lendingPool.connect(owner).setLoanManager(loanManagerSigner.address);

    // Provide initial funds to lender and borrower
    await mockUSDC.connect(lender).faucet(lender.address, 5_000n * ONE_USDC);
    await mockUSDC.connect(borrower).faucet(borrower.address, 5_000n * ONE_USDC);
  });

  describe("Initialization & Access Control", function () {
    it("Should point to the correct token address", async function () {
      expect(await lendingPool.token()).to.equal(await mockUSDC.getAddress());
    });

    it("Should allow only owner to set loanManager", async function () {
      await expect(
        lendingPool.connect(stranger).setLoanManager(stranger.address)
      ).to.be.revertedWithCustomError(lendingPool, "OwnableUnauthorizedAccount");

      await expect(lendingPool.connect(owner).setLoanManager(stranger.address))
        .to.emit(lendingPool, "LoanManagerUpdated")
        .withArgs(loanManagerSigner.address, stranger.address);

      expect(await lendingPool.loanManager()).to.equal(stranger.address);
    });

    it("Should revert transferFunds if called by unauthorized account", async function () {
      await expect(
        lendingPool.connect(stranger).transferFunds(lender.address, borrower.address, 100n * ONE_USDC)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");
    });

    it("Should revert executeRepayment if called by unauthorized account", async function () {
      await expect(
        lendingPool.connect(stranger).executeRepayment(borrower.address, lender.address, 100n * ONE_USDC)
      ).to.be.revertedWith("LendingPool: Caller is not authorized LoanManager");
    });
  });

  describe("Token Transfer Operations (Authorized)", function () {
    it("Should safely transfer funds from lender to borrower upon funding", async function () {
      const loanAmount = 500n * ONE_USDC;
      // Lender approves lending pool
      await mockUSDC.connect(lender).approve(await lendingPool.getAddress(), loanAmount);

      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);

      await expect(
        lendingPool.connect(loanManagerSigner).transferFunds(lender.address, borrower.address, loanAmount)
      )
        .to.emit(lendingPool, "FundsDisbursed")
        .withArgs(lender.address, borrower.address, loanAmount);

      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalBefore + loanAmount);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore - loanAmount);
    });

    it("Should safely transfer repayment from borrower to lender", async function () {
      const repayAmount = 550n * ONE_USDC;
      // Borrower approves lending pool
      await mockUSDC.connect(borrower).approve(await lendingPool.getAddress(), repayAmount);

      const borrowerBalBefore = await mockUSDC.balanceOf(borrower.address);
      const lenderBalBefore = await mockUSDC.balanceOf(lender.address);

      await expect(
        lendingPool.connect(loanManagerSigner).executeRepayment(borrower.address, lender.address, repayAmount)
      )
        .to.emit(lendingPool, "RepaymentTransferred")
        .withArgs(borrower.address, lender.address, repayAmount);

      expect(await mockUSDC.balanceOf(borrower.address)).to.equal(borrowerBalBefore - repayAmount);
      expect(await mockUSDC.balanceOf(lender.address)).to.equal(lenderBalBefore + repayAmount);
    });
  });
});
