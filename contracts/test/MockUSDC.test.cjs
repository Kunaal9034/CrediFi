const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC Contract", function () {
  let mockUSDC;
  let owner, user1, user2;
  const DECIMALS = 6n;
  const ONE_USDC = 10n ** DECIMALS;
  const FAUCET_LIMIT = 10_000n * ONE_USDC;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy(owner.address);
  });

  describe("Initialization", function () {
    it("Should initialize with correct name, symbol, and 6 decimals", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USD Coin");
      expect(await mockUSDC.symbol()).to.equal("mUSDC");
      expect(await mockUSDC.decimals()).to.equal(6);
    });

    it("Should mint initial 1,000,000 mUSDC supply to owner", async function () {
      const expectedSupply = 1_000_000n * ONE_USDC;
      expect(await mockUSDC.totalSupply()).to.equal(expectedSupply);
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(expectedSupply);
    });
  });

  describe("Faucet Functionality", function () {
    it("Should allow a user to request faucet tokens within limit", async function () {
      const faucetAmount = 1_000n * ONE_USDC;
      await expect(mockUSDC.connect(user1).faucet(user1.address, faucetAmount))
        .to.emit(mockUSDC, "FaucetUsed")
        .withArgs(user1.address, faucetAmount);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(faucetAmount);
    });

    it("Should revert if faucet amount is zero", async function () {
      await expect(
        mockUSDC.connect(user1).faucet(user1.address, 0)
      ).to.be.revertedWith("MockUSDC: Amount must be greater than zero");
    });

    it("Should revert if faucet amount exceeds FAUCET_LIMIT", async function () {
      const excessiveAmount = FAUCET_LIMIT + 1n;
      await expect(
        mockUSDC.connect(user1).faucet(user1.address, excessiveAmount)
      ).to.be.revertedWith("MockUSDC: Amount exceeds faucet limit (10,000 mUSDC)");
    });

    it("Should revert if recipient address is zero", async function () {
      await expect(
        mockUSDC.connect(user1).faucet(ethers.ZeroAddress, 100n * ONE_USDC)
      ).to.be.revertedWith("MockUSDC: Invalid recipient");
    });
  });

  describe("Owner Minting", function () {
    it("Should allow owner to mint arbitrary amounts", async function () {
      const mintAmount = 50_000n * ONE_USDC;
      await mockUSDC.connect(owner).mint(user2.address, mintAmount);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(mintAmount);
    });

    it("Should prevent non-owners from calling mint", async function () {
      await expect(
        mockUSDC.connect(user1).mint(user1.address, 1_000n * ONE_USDC)
      ).to.be.revertedWithCustomError(mockUSDC, "OwnableUnauthorizedAccount");
    });
  });

  describe("Standard ERC20 Transfers", function () {
    it("Should perform standard transfer between accounts", async function () {
      const transferAmount = 500n * ONE_USDC;
      await mockUSDC.connect(owner).transfer(user1.address, transferAmount);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(transferAmount);

      await mockUSDC.connect(user1).transfer(user2.address, 200n * ONE_USDC);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(200n * ONE_USDC);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(300n * ONE_USDC);
    });

    it("Should support approve and transferFrom", async function () {
      const approveAmount = 1_000n * ONE_USDC;
      await mockUSDC.connect(owner).approve(user1.address, approveAmount);
      expect(await mockUSDC.allowance(owner.address, user1.address)).to.equal(approveAmount);

      await mockUSDC.connect(user1).transferFrom(owner.address, user2.address, 400n * ONE_USDC);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(400n * ONE_USDC);
      expect(await mockUSDC.allowance(owner.address, user1.address)).to.equal(600n * ONE_USDC);
    });
  });
});
