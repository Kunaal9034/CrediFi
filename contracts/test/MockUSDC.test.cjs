const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC Contract", function () {
  let mockUSDC;
  let owner, user1, user2, user3;

  // Base unit constants (6 decimals)
  // 1 mUSDC = 1_000_000 units
  // 10 mUSDC = 10_000_000 units
  // 10,000 mUSDC = 10_000_000_000 units
  const ONE_MUSDC = 1_000_000n;
  const TEN_MUSDC = 10_000_000n;
  const MAX_FAUCET_AMOUNT = 10_000_000_000n; // 10,000 mUSDC

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
  });

  describe("ERC20 Metadata & Initial Supply", function () {
    it("Should have correct token name", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USD Coin");
    });

    it("Should have correct token symbol", async function () {
      expect(await mockUSDC.symbol()).to.equal("mUSDC");
    });

    it("Should have decimals == 6", async function () {
      expect(await mockUSDC.decimals()).to.equal(6);
    });

    it("Should have initial supply == 0", async function () {
      expect(await mockUSDC.totalSupply()).to.equal(0n);
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(0n);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(0n);
    });
  });

  describe("Faucet Functionality", function () {
    it("Should mint correct amount via faucet", async function () {
      const claimAmount = TEN_MUSDC; // 10 mUSDC = 10_000_000 units
      await mockUSDC.connect(user1).faucet(user1.address, claimAmount);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(10_000_000n);
      expect(await mockUSDC.totalSupply()).to.equal(10_000_000n);
    });

    it("Should work for arbitrary demo wallet", async function () {
      const claimAmount = 500_000_000n; // 500 mUSDC
      // user1 calls faucet on behalf of user2 (arbitrary demo wallet)
      await mockUSDC.connect(user1).faucet(user2.address, claimAmount);

      expect(await mockUSDC.balanceOf(user2.address)).to.equal(500_000_000n);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(0n);
    });

    it("Should revert if faucet amount is zero", async function () {
      await expect(
        mockUSDC.connect(user1).faucet(user1.address, 0n)
      ).to.be.revertedWith("MockUSDC: Zero amount");
    });

    it("Should revert if recipient address is zero", async function () {
      await expect(
        mockUSDC.connect(user1).faucet(ethers.ZeroAddress, TEN_MUSDC)
      ).to.be.revertedWith("MockUSDC: Zero address");
    });

    it("Should revert if amount above 10,000 mUSDC", async function () {
      const excessiveAmount = 10_000_000_001n; // 10,000 mUSDC + 1 unit
      await expect(
        mockUSDC.connect(user1).faucet(user1.address, excessiveAmount)
      ).to.be.revertedWith("MockUSDC: Amount exceeds faucet limit (10,000 mUSDC)");
    });

    it("Should succeed for exact 10,000 mUSDC claim", async function () {
      await mockUSDC.connect(user1).faucet(user1.address, MAX_FAUCET_AMOUNT);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(10_000_000_000n);
      expect(await mockUSDC.totalSupply()).to.equal(10_000_000_000n);
    });

    it("Should emit FaucetMinted event with correct arguments", async function () {
      await expect(mockUSDC.connect(user1).faucet(user1.address, MAX_FAUCET_AMOUNT))
        .to.emit(mockUSDC, "FaucetMinted")
        .withArgs(user1.address, 10_000_000_000n);
    });

    it("Should support multiple valid faucet calls", async function () {
      const claim1 = 1_000_000_000n; // 1,000 mUSDC
      const claim2 = 2_500_000_000n; // 2,500 mUSDC

      await mockUSDC.connect(user1).faucet(user1.address, claim1);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(1_000_000_000n);

      await mockUSDC.connect(user1).faucet(user1.address, claim2);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(3_500_000_000n);
      expect(await mockUSDC.totalSupply()).to.equal(3_500_000_000n);
    });
  });

  describe("Standard ERC20 Operations", function () {
    beforeEach(async function () {
      // Seed user1 with 5,000 mUSDC via faucet
      await mockUSDC.connect(user1).faucet(user1.address, 5_000_000_000n);
    });

    it("Should execute ERC20 transfer correctly", async function () {
      const transferAmount = 1_500_000_000n; // 1,500 mUSDC

      await mockUSDC.connect(user1).transfer(user2.address, transferAmount);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(3_500_000_000n);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(1_500_000_000n);
    });

    it("Should execute ERC20 approve correctly", async function () {
      const approveAmount = 2_000_000_000n; // 2,000 mUSDC

      await mockUSDC.connect(user1).approve(user2.address, approveAmount);

      expect(await mockUSDC.allowance(user1.address, user2.address)).to.equal(2_000_000_000n);
    });

    it("Should execute ERC20 transferFrom correctly", async function () {
      const approveAmount = 1_000_000_000n; // 1,000 mUSDC
      const transferAmount = 500_000_000n;  // 500 mUSDC

      await mockUSDC.connect(user1).approve(user2.address, approveAmount);
      await mockUSDC.connect(user2).transferFrom(user1.address, user3.address, transferAmount);

      expect(await mockUSDC.balanceOf(user3.address)).to.equal(500_000_000n);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(4_500_000_000n);
    });

    it("Should decrease allowance correctly upon transferFrom", async function () {
      const approveAmount = 2_000_000_000n; // 2,000 mUSDC
      const transferAmount = 750_000_000n;  // 750 mUSDC

      await mockUSDC.connect(user1).approve(user2.address, approveAmount);
      expect(await mockUSDC.allowance(user1.address, user2.address)).to.equal(2_000_000_000n);

      await mockUSDC.connect(user2).transferFrom(user1.address, user3.address, transferAmount);

      // Allowance must decrease strictly by transferAmount: 2,000 - 750 = 1,250 mUSDC
      expect(await mockUSDC.allowance(user1.address, user2.address)).to.equal(1_250_000_000n);
    });
  });
});
