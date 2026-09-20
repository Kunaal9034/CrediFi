const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Hardhat Environment Setup", function () {
  it("Should load ethers and retrieve default signers", async function () {
    const [deployer, borrower, lender] = await ethers.getSigners();
    expect(deployer.address).to.be.properAddress;
    expect(borrower.address).to.be.properAddress;
    expect(lender.address).to.be.properAddress;
  });

  it("Should correctly report chainId 31337 for in-memory hardhat network", async function () {
    const network = await ethers.provider.getNetwork();
    expect(network.chainId).to.equal(31337n);
  });
});
