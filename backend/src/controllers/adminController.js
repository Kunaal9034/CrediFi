const crypto = require('crypto');
const { ethers } = require('ethers');
const { processBlockchainEvent, EXPECTED_CHAIN_ID } = require('../services/eventProcessor');

const LOAN_MANAGER_EVENTS_ABI = [
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 interestRateBps, uint256 duration, uint256 totalDue, uint256 dueDate)',
  'event LoanFunded(uint256 indexed loanId, address indexed lender, address indexed borrower, uint256 principal, uint256 dueDate)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal, uint256 totalDue, uint8 repaymentType)',
  'event LoanDefaulted(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal)',
];

const CREDIT_REGISTRY_EVENTS_ABI = [
  'event CreditProfileUpdated(address indexed borrower, uint256 score, uint256 borrowingLimit)',
];

function verifyAdminSecret(req) {
  const configuredSecret = process.env.ADMIN_SECRET;
  if (!configuredSecret) return false;

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const customHeader = req.headers['x-admin-secret'] || '';
  const provided = token || customHeader;

  if (!provided) return false;

  const confBuf = Buffer.from(configuredSecret, 'utf8');
  const provBuf = Buffer.from(provided, 'utf8');

  if (confBuf.length !== provBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(confBuf, provBuf);
}

/**
 * POST /api/admin/backfill
 * Administrative backfill endpoint to query RPC and re-index historical blocks.
 * Protected by ADMIN_SECRET.
 */
exports.backfill = async (req, res) => {
  try {
    if (!verifyAdminSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing ADMIN_SECRET' });
    }

    const { fromBlock, toBlock, logs: explicitLogs } = req.body || {};

    let processedCount = 0;
    let duplicateCount = 0;

    // If explicit test logs are provided in body (e.g. for offline testing)
    if (Array.isArray(explicitLogs)) {
      for (const log of explicitLogs) {
        const result = await processBlockchainEvent({
          chainId: EXPECTED_CHAIN_ID,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex || 0,
          contractAddress: log.contractAddress,
          eventName: log.eventName,
          blockNumber: log.blockNumber || 0,
          args: log.args || {},
        });
        if (result.duplicate) duplicateCount++;
        else processedCount++;
      }

      return res.status(200).json({
        status: 'ok',
        source: 'explicit_logs',
        processed: processedCount,
        duplicates: duplicateCount,
      });
    }

    // Query onchain RPC provider
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    if (!rpcUrl || rpcUrl.includes('YOUR_ALCHEMY_API_KEY')) {
      return res.status(200).json({
        status: 'ok',
        message: 'RPC not configured or offline; no blocks fetched',
        processed: 0,
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const startBlock = Number(fromBlock || 0);
    const endBlock = toBlock ? Number(toBlock) : await provider.getBlockNumber();

    const loanManagerAddress = (process.env.LOAN_MANAGER_ADDRESS || '0x21b39401646D783690E3902C90963c711Ff7cC1C').toLowerCase();
    const creditRegistryAddress = (process.env.CREDIT_REGISTRY_ADDRESS || '0x9b117D9528c43Fb2938e43172b1935f38F2C6f90').toLowerCase();

    const lmInterface = new ethers.Interface(LOAN_MANAGER_EVENTS_ABI);
    const crInterface = new ethers.Interface(CREDIT_REGISTRY_EVENTS_ABI);

    const logs = await provider.getLogs({
      fromBlock: startBlock,
      toBlock: endBlock,
      address: [loanManagerAddress, creditRegistryAddress],
    });

    for (const log of logs) {
      try {
        let parsed = null;
        if (log.address.toLowerCase() === loanManagerAddress) {
          parsed = lmInterface.parseLog(log);
        } else if (log.address.toLowerCase() === creditRegistryAddress) {
          parsed = crInterface.parseLog(log);
        }

        if (parsed) {
          const argsObj = {};
          for (const key of Object.keys(parsed.args)) {
            if (isNaN(Number(key))) {
              argsObj[key] = parsed.args[key].toString();
            }
          }

          const result = await processBlockchainEvent({
            chainId: EXPECTED_CHAIN_ID,
            transactionHash: log.transactionHash,
            logIndex: log.index,
            contractAddress: log.address,
            eventName: parsed.name,
            blockNumber: log.blockNumber,
            args: argsObj,
          });

          if (result.duplicate) duplicateCount++;
          else processedCount++;
        }
      } catch (logErr) {
        console.warn('[adminBackfill] Skipped unparsable log:', logErr.message);
      }
    }

    return res.status(200).json({
      status: 'ok',
      fromBlock: startBlock,
      toBlock: endBlock,
      totalLogsFound: logs.length,
      processed: processedCount,
      duplicates: duplicateCount,
    });
  } catch (err) {
    console.error('[adminBackfill] Backfill error:', err);
    return res.status(500).json({ error: 'Backfill operation failed' });
  }
};
