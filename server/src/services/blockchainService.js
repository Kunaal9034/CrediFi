const { ethers } = require('ethers');
const HashingService = require('./hashingService');
const { CUSTODY_ACTION_ENUM_MAP, CUSTODY_ACTION_FROM_ENUM } = require('../constants/custodyActions');

class BlockchainService {
  constructor() {
    this.rpcUrl = process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';
    this.contractAddress = process.env.CONTRACT_ADDRESS || '';
    this.operatorPrivateKey = process.env.OPERATOR_PRIVATE_KEY || '';
    
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.isInitialized = false;

    this.init();
  }

  init() {
    try {
      if (!this.contractAddress) {
        console.warn('[BlockchainService] CONTRACT_ADDRESS is not set in environment. Running in unconfigured mode until deployed.');
        return;
      }

      const contractConfig = require('../config/contractAbi.json');
      const abi = contractConfig.abi || contractConfig;

      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      if (this.operatorPrivateKey && this.operatorPrivateKey !== '0x0000000000000000000000000000000000000000000000000000000000000001') {
        this.wallet = new ethers.Wallet(this.operatorPrivateKey, this.provider);
        this.contract = new ethers.Contract(this.contractAddress, abi, this.wallet);
      } else {
        // Read-only contract instance
        this.contract = new ethers.Contract(this.contractAddress, abi, this.provider);
      }

      this.isInitialized = true;
      console.log(`[BlockchainService] Connected to network at ${this.rpcUrl}, contract: ${this.contractAddress}`);
    } catch (err) {
      console.error(`[BlockchainService] Initialization error: ${err.message}`);
    }
  }

  /**
   * Check if smart contract and operator wallet are fully configured
   */
  isReady() {
    return Boolean(this.isInitialized && this.contract && this.wallet);
  }

  /**
   * Ensure service is initialized before performing operations
   */
  checkInitialization() {
    if (!this.isInitialized || !this.contract) {
      this.init();
      if (!this.contract) {
        throw new Error('BlockchainService: Smart contract is not configured. Please set CONTRACT_ADDRESS in .env.');
      }
    }
  }

  /**
   * Register evidence on the Polygon Amoy smart contract
   * @param {string} evidenceId - e.g. "EV-2026-001"
   * @param {string} caseId - e.g. "CASE-2026-001"
   * @param {string} sha256Hex - 64-char hex string
   * @param {string} ipfsCid - IPFS Content Identifier
   * @param {string} actorAddress - Ethereum address of the registering officer
   * @returns {Promise<{ transactionHash: string, blockNumber: number }>}
   */
  async registerEvidenceOnChain(evidenceId, caseId, sha256Hex, ipfsCid, actorAddress = ethers.ZeroAddress) {
    this.checkInitialization();

    if (!this.wallet) {
      throw new Error('BlockchainService: Operator private key is required to register evidence on-chain.');
    }

    const sha256Bytes32 = HashingService.hexToBytes32(sha256Hex);
    const validActor = ethers.isAddress(actorAddress) ? actorAddress : this.wallet.address;

    console.log(`[BlockchainService] Submitting registerEvidence tx for ${evidenceId}...`);
    const tx = await this.contract.registerEvidence(
      evidenceId,
      caseId,
      sha256Bytes32,
      ipfsCid,
      validActor
    );

    const receipt = await tx.wait(1);
    console.log(`[BlockchainService] Evidence registered on-chain. Tx: ${receipt.hash}, Block: ${receipt.blockNumber}`);

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  /**
   * Record a custody transition event on-chain
   * @param {string} evidenceId
   * @param {string} actionName - 'REGISTERED'|'ACCESSED'|'TRANSFERRED'|'ANALYZED'|'VERIFIED'|'FLAGGED'
   * @param {string} actorAddress
   * @param {string} fromAddress
   * @param {string} toAddress
   * @param {string} reason
   * @returns {Promise<{ transactionHash: string, blockNumber: number }>}
   */
  async recordCustodyEventOnChain(evidenceId, actionName, actorAddress, fromAddress, toAddress, reason) {
    this.checkInitialization();

    if (!this.wallet) {
      throw new Error('BlockchainService: Operator private key is required to write custody events on-chain.');
    }

    const actionEnum = CUSTODY_ACTION_ENUM_MAP[actionName];
    if (actionEnum === undefined) {
      throw new Error(`Invalid custody action: ${actionName}`);
    }

    const actor = ethers.isAddress(actorAddress) ? actorAddress : this.wallet.address;
    const from = ethers.isAddress(fromAddress) ? fromAddress : ethers.ZeroAddress;
    const to = ethers.isAddress(toAddress) ? toAddress : ethers.ZeroAddress;

    console.log(`[BlockchainService] Submitting recordCustodyEvent tx: [${actionName}] for ${evidenceId}...`);
    const tx = await this.contract.recordCustodyEvent(
      evidenceId,
      actionEnum,
      actor,
      from,
      to,
      reason
    );

    const receipt = await tx.wait(1);
    console.log(`[BlockchainService] Custody event recorded. Tx: ${receipt.hash}, Block: ${receipt.blockNumber}`);

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  /**
   * Fetch immutable evidence record directly from the smart contract
   * @param {string} evidenceId
   */
  async getEvidenceFromChain(evidenceId) {
    this.checkInitialization();

    const record = await this.contract.getEvidence(evidenceId);
    return {
      evidenceId: record[0],
      caseId: record[1],
      sha256Hex: HashingService.bytes32ToHex(record[2]),
      ipfsCid: record[3],
      registeredBy: record[4],
      registeredAt: Number(record[5]),
      exists: record[6]
    };
  }

  /**
   * Cryptographically verify test hash against on-chain hash
   * @param {string} evidenceId
   * @param {string} testSha256Hex
   * @returns {Promise<boolean>}
   */
  async verifyHashOnChain(evidenceId, testSha256Hex) {
    this.checkInitialization();
    const testBytes32 = HashingService.hexToBytes32(testSha256Hex);
    return await this.contract.verifyEvidenceHash(evidenceId, testBytes32);
  }

  /**
   * Get transaction receipt and status from Polygon Amoy
   * @param {string} txHash
   */
  async getTransactionReceipt(txHash) {
    this.checkInitialization();
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) return null;

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      from: receipt.from,
      to: receipt.to,
      status: receipt.status === 1 ? 'SUCCESS' : 'FAILED',
      gasUsed: receipt.gasUsed.toString()
    };
  }
}

module.exports = new BlockchainService();
