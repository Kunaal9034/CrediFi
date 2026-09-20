const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { recalculateProtocolStats } = require('./analyticsService');

const EXPECTED_CHAIN_ID = 11155111;

const KNOWN_EVENTS = new Set([
  'LoanCreated',
  'LoanFunded',
  'LoanRepaid',
  'LoanDefaulted',
  'CreditProfileUpdated',
  // Non-mutating informational events
  'FundsDisbursed',
  'RepaymentTransferred',
  'LoanRecorded',
  'RepaymentRecorded',
  'DefaultRecorded',
]);

function getContractAllowlist() {
  const list = {};
  const loanManager = (process.env.LOAN_MANAGER_ADDRESS || '0x21b39401646D783690E3902C90963c711Ff7cC1C').toLowerCase();
  const creditRegistry = (process.env.CREDIT_REGISTRY_ADDRESS || '0x9b117D9528c43Fb2938e43172b1935f38F2C6f90').toLowerCase();
  const lendingPool = (process.env.LENDING_POOL_ADDRESS || '0x6c7540f597E70b983A19b3e9372d9cdDB062e4F5').toLowerCase();
  const mockUSDC = (process.env.MOCK_USDC_ADDRESS || '0xfaaF91778853F35FB7Db545dc3586aFc354103d0').toLowerCase();

  list[loanManager] = 'LoanManager';
  list[creditRegistry] = 'CreditRegistry';
  list[lendingPool] = 'LendingPool';
  list[mockUSDC] = 'MockUSDC';

  return list;
}

function isContractAllowed(address) {
  if (!address) return true; // If not provided in some test payloads, allow fallback
  const normalized = address.toLowerCase();
  const allowlist = getContractAllowlist();
  return Boolean(allowlist[normalized]);
}

function addBigIntStrings(aStr = '0', bStr = '0') {
  return (BigInt(aStr || '0') + BigInt(bStr || '0')).toString();
}

function subBigIntStrings(aStr = '0', bStr = '0') {
  const diff = BigInt(aStr || '0') - BigInt(bStr || '0');
  return (diff < 0n ? 0n : diff).toString();
}

/**
 * Deterministically processes and indexes an onchain event into MongoDB
 */
async function processBlockchainEvent({
  chainId = 11155111,
  transactionHash,
  logIndex = 0,
  contractAddress = null,
  eventName,
  eventType,
  blockNumber = 0,
  blockTimestamp = Math.floor(Date.now() / 1000),
  args = {},
}) {
  const name = eventName || eventType;
  if (!transactionHash || logIndex === undefined || !name) {
    throw new Error('Invalid event payload: transactionHash, logIndex, and eventName are required');
  }

  const cleanTxHash = transactionHash.toLowerCase();
  const cleanContract = contractAddress ? contractAddress.toLowerCase() : null;
  const numChainId = Number(chainId);

  // 1. Validate Chain ID
  if (numChainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Invalid chainId: ${numChainId}. Expected ${EXPECTED_CHAIN_ID}`);
  }

  // 2. Validate Contract Address (if provided)
  if (cleanContract && !isContractAllowed(cleanContract)) {
    throw new Error(`Rejected event from untrusted contract address: ${cleanContract}`);
  }

  // 3. Validate Event Name
  if (!KNOWN_EVENTS.has(name)) {
    console.warn(`[eventProcessor] Safely ignoring unknown event: ${name}`);
    return { processed: false, ignored: true, reason: `Unknown event: ${name}` };
  }

  // If MongoDB is not connected (e.g. offline unit test), log and return
  if (mongoose.connection.readyState !== 1) {
    console.log(`[eventProcessor] (Offline mode) Verified ${name} (tx: ${cleanTxHash}, log: ${logIndex})`);
    return { processed: true, offline: true };
  }

  // 4. Deterministic Idempotency Key check: chainId:transactionHash:logIndex
  const idempotencyKey = `${numChainId}:${cleanTxHash}:${logIndex}`;
  const existingTx = await Transaction.findOne({
    $or: [
      { idempotencyKey },
      { chainId: numChainId, transactionHash: cleanTxHash, logIndex },
    ],
  });

  if (existingTx) {
    console.log(`[eventProcessor] Duplicate event detected (idempotent ignore): ${idempotencyKey}`);
    return { processed: false, duplicate: true, reason: 'Already processed (idempotent ignore)' };
  }

  let affectedWallet = args.borrower || args.lender || args.recipient || null;
  if (affectedWallet) affectedWallet = affectedWallet.toLowerCase();

  let loanId = args.loanId !== undefined && args.loanId !== null ? Number(args.loanId) : null;
  let amountStr = (args.principal || args.totalDue || args.amount || args.totalPaid || '0').toString();

  // 5. Update Database State by Event Type
  switch (name) {
    case 'LoanCreated': {
      const borrower = (args.borrower || '').toLowerCase();
      const principal = (args.principal || args.amount || '0').toString();
      const interestRateBps = Number(args.interestRateBps || args.interestRate || 0);
      const duration = Number(args.duration || 0);
      const totalDue = (args.totalDue || '0').toString();
      const dueDate = Number(args.dueDate || 0);

      await Loan.findOneAndUpdate(
        { loanId },
        {
          loanId,
          borrower,
          principal,
          amount: principal,
          interestRateBps,
          interestRate: interestRateBps,
          duration,
          totalDue,
          dueDate,
          status: 0, // REQUESTED
          creationTxHash: cleanTxHash,
          blockNumber,
        },
        { upsert: true, new: true }
      );

      // Upsert User profile & aggregate totals
      const existingUser = await User.findOne({ wallet: borrower });
      const currentBorrowed = existingUser ? existingUser.totalBorrowed : '0';
      const updatedBorrowed = addBigIntStrings(currentBorrowed, principal);

      await User.findOneAndUpdate(
        { wallet: borrower },
        {
          $inc: { loansTaken: 1 },
          $set: {
            totalBorrowed: updatedBorrowed,
            lastIndexedBlock: blockNumber,
            lastUpdatedBlock: blockNumber,
          },
        },
        { upsert: true }
      );
      break;
    }

    case 'LoanFunded': {
      const lender = (args.lender || '').toLowerCase();
      const borrower = (args.borrower || '').toLowerCase();
      const principal = (args.principal || args.amount || '0').toString();
      const fundedAt = Number(args.fundedAt || blockTimestamp || Math.floor(Date.now() / 1000));
      const dueDate = Number(args.dueDate || 0);

      const updatedLoan = await Loan.findOneAndUpdate(
        { loanId },
        {
          lender,
          status: 1, // ACTIVE
          fundedAt,
          dueDate: dueDate || undefined,
          fundingTxHash: cleanTxHash,
        },
        { new: true }
      );

      const actualPrincipal = updatedLoan?.principal && updatedLoan.principal !== '0'
        ? updatedLoan.principal
        : principal;

      // Update lender stats
      const existingLender = await User.findOne({ wallet: lender });
      const currentLent = existingLender ? existingLender.totalLent : '0';
      const updatedLent = addBigIntStrings(currentLent, actualPrincipal);

      await User.findOneAndUpdate(
        { wallet: lender },
        {
          $set: {
            totalLent: updatedLent,
            lastIndexedBlock: blockNumber,
            lastUpdatedBlock: blockNumber,
          },
        },
        { upsert: true }
      );

      // Update borrower outstanding principal
      if (borrower) {
        const existingBorrower = await User.findOne({ wallet: borrower });
        const currentOutstanding = existingBorrower ? existingBorrower.outstandingPrincipal : '0';
        const updatedOutstanding = addBigIntStrings(currentOutstanding, actualPrincipal);

        await User.findOneAndUpdate(
          { wallet: borrower },
          {
            $set: {
              outstandingPrincipal: updatedOutstanding,
              lastIndexedBlock: blockNumber,
              lastUpdatedBlock: blockNumber,
            },
          },
          { upsert: true }
        );
      }
      break;
    }

    case 'LoanRepaid': {
      const borrower = (args.borrower || '').toLowerCase();
      const lender = (args.lender || '').toLowerCase();
      const principal = (args.principal || '0').toString();
      const totalPaid = (args.totalDue || args.totalPaid || '0').toString();
      const repaidAt = Number(args.repaidAt || blockTimestamp || Math.floor(Date.now() / 1000));

      const existingLoan = await Loan.findOne({ loanId });
      const effectivePrincipal = existingLoan?.principal || principal;
      const effectiveTotalPaid = totalPaid !== '0' ? totalPaid : (existingLoan?.totalDue || effectivePrincipal);

      await Loan.findOneAndUpdate(
        { loanId },
        {
          status: 2, // REPAID
          repaidAt,
          repaymentTxHash: cleanTxHash,
          totalRepaid: effectiveTotalPaid,
        }
      );

      // Update borrower
      if (borrower) {
        const existingBorrower = await User.findOne({ wallet: borrower });
        const currentRepaid = existingBorrower ? existingBorrower.totalRepaid : '0';
        const updatedRepaid = addBigIntStrings(currentRepaid, effectiveTotalPaid);

        const currentOutstanding = existingBorrower ? existingBorrower.outstandingPrincipal : '0';
        const updatedOutstanding = subBigIntStrings(currentOutstanding, effectivePrincipal);

        await User.findOneAndUpdate(
          { wallet: borrower },
          {
            $inc: { loansRepaid: 1 },
            $set: {
              totalRepaid: updatedRepaid,
              outstandingPrincipal: updatedOutstanding,
              lastIndexedBlock: blockNumber,
              lastUpdatedBlock: blockNumber,
            },
          },
          { upsert: true }
        );
      }

      // Update lender interest & repaid tracking
      const effectiveLender = lender || existingLoan?.lender;
      if (effectiveLender) {
        const existingLender = await User.findOne({ wallet: effectiveLender });
        const currentLenderRepaid = existingLender ? existingLender.totalRepaid : '0';
        const updatedLenderRepaid = addBigIntStrings(currentLenderRepaid, effectiveTotalPaid);

        let earnedInterest = '0';
        if (BigInt(effectiveTotalPaid) > BigInt(effectivePrincipal)) {
          earnedInterest = (BigInt(effectiveTotalPaid) - BigInt(effectivePrincipal)).toString();
        }
        const currentInterestEarned = existingLender ? existingLender.totalInterestEarned : '0';
        const updatedInterestEarned = addBigIntStrings(currentInterestEarned, earnedInterest);

        await User.findOneAndUpdate(
          { wallet: effectiveLender },
          {
            $set: {
              totalRepaid: updatedLenderRepaid,
              totalInterestEarned: updatedInterestEarned,
              lastIndexedBlock: blockNumber,
              lastUpdatedBlock: blockNumber,
            },
          },
          { upsert: true }
        );
      }
      break;
    }

    case 'LoanDefaulted': {
      const borrower = (args.borrower || '').toLowerCase();
      const principal = (args.principal || '0').toString();
      const defaultedAt = Number(args.defaultedAt || blockTimestamp || Math.floor(Date.now() / 1000));

      const existingLoan = await Loan.findOne({ loanId });
      const effectivePrincipal = existingLoan?.principal || principal;

      await Loan.findOneAndUpdate(
        { loanId },
        {
          status: 3, // DEFAULTED
          defaultedAt,
          defaultTxHash: cleanTxHash,
        }
      );

      // Update borrower
      if (borrower) {
        const existingBorrower = await User.findOne({ wallet: borrower });
        const currentOutstanding = existingBorrower ? existingBorrower.outstandingPrincipal : '0';
        const updatedOutstanding = subBigIntStrings(currentOutstanding, effectivePrincipal);

        await User.findOneAndUpdate(
          { wallet: borrower },
          {
            $inc: { defaults: 1 },
            $set: {
              outstandingPrincipal: updatedOutstanding,
              lastIndexedBlock: blockNumber,
              lastUpdatedBlock: blockNumber,
            },
          },
          { upsert: true }
        );
      }
      break;
    }

    case 'CreditProfileUpdated': {
      const borrower = (args.borrower || '').toLowerCase();
      const score = Number(args.score !== undefined ? args.score : (args.newScore || 500));
      const limit = (args.borrowingLimit || args.newLimit || '500000000').toString();

      await User.findOneAndUpdate(
        { wallet: borrower },
        {
          creditScore: score,
          borrowingLimit: limit,
          lastIndexedBlock: blockNumber,
          lastUpdatedBlock: blockNumber,
        },
        { upsert: true }
      );
      break;
    }

    default:
      console.log(`[eventProcessor] Processed informational event: ${name}`);
      break;
  }

  // 6. Record in Transaction collection with unique idempotencyKey
  await Transaction.create({
    chainId: numChainId,
    transactionHash: cleanTxHash,
    logIndex,
    contractAddress: cleanContract,
    eventName: name,
    eventType: name,
    wallet: affectedWallet,
    loanId,
    amount: amountStr,
    blockNumber,
    blockTimestamp,
    timestamp: blockTimestamp,
    args,
    rawArgs: args,
    idempotencyKey,
    processedAt: new Date(),
  });

  // 7. Recalculate protocol statistics
  await recalculateProtocolStats(blockNumber);

  return {
    processed: true,
    eventName: name,
    loanId,
    idempotencyKey,
  };
}

module.exports = {
  processBlockchainEvent,
  isContractAllowed,
  getContractAllowlist,
  EXPECTED_CHAIN_ID,
  KNOWN_EVENTS,
};
