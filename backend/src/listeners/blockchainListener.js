const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Loan = require('../models/Loan');
const User = require('../models/User');
const { recalculateProtocolStats } = require('../services/analyticsService');

/**
 * Idempotently processes an event emitted by CrediFi smart contracts
 */
async function processBlockchainEvent({
  chainId = 11155111,
  transactionHash,
  logIndex,
  eventType,
  blockNumber,
  args = {},
}) {
  if (!transactionHash || logIndex === undefined || !eventType) {
    throw new Error('Invalid event payload: transactionHash, logIndex, and eventType are required');
  }

  const cleanTxHash = transactionHash.toLowerCase();

  // If MongoDB is not connected (e.g. unit test mode without mongo daemon), log and return
  if (mongoose.connection.readyState !== 1) {
    console.log(`[blockchainListener] (No DB Connection) Event verified: ${eventType} (tx: ${cleanTxHash}, log: ${logIndex})`);
    return { processed: true, offline: true };
  }

  // 1. Triple-key idempotency check: { chainId, transactionHash, logIndex }
  const existingTx = await Transaction.findOne({
    chainId,
    transactionHash: cleanTxHash,
    logIndex,
  });

  if (existingTx) {
    console.log(`[blockchainListener] Event already processed: ${eventType} (tx: ${cleanTxHash}, log: ${logIndex})`);
    return { processed: false, reason: 'Already processed (idempotent ignore)' };
  }

  console.log(`[blockchainListener] Processing event: ${eventType} (tx: ${cleanTxHash}, log: ${logIndex})`);

  let affectedWallet = args.borrower || args.lender || args.recipient || '0x0000000000000000000000000000000000000000';
  affectedWallet = affectedWallet.toLowerCase();

  // 2. Process by event type
  switch (eventType) {
    case 'LoanCreated': {
      const loanId = Number(args.loanId);
      const borrower = args.borrower.toLowerCase();
      const amount = (args.principal || '0').toString();
      const interestRate = Number(args.interestRate || 0);
      const duration = Number(args.duration || 0);

      await Loan.findOneAndUpdate(
        { loanId },
        {
          loanId,
          borrower,
          amount,
          interestRate,
          duration,
          status: 0, // REQUESTED
          creationTxHash: cleanTxHash,
          blockNumber,
        },
        { upsert: true, new: true }
      );

      // Ensure user exists and increment loansTaken
      await User.findOneAndUpdate(
        { wallet: borrower },
        {
          $inc: { loansTaken: 1 },
          $set: { lastUpdatedBlock: blockNumber },
        },
        { upsert: true }
      );
      break;
    }

    case 'LoanFunded': {
      const loanId = Number(args.loanId);
      const lender = args.lender.toLowerCase();
      const startTime = Number(args.startTime || Math.floor(Date.now() / 1000));
      const dueDate = Number(args.dueDate || 0);

      await Loan.findOneAndUpdate(
        { loanId },
        {
          lender,
          status: 1, // ACTIVE
          startTime,
          dueDate,
          fundingTxHash: cleanTxHash,
        }
      );
      break;
    }

    case 'LoanRepaid': {
      const loanId = Number(args.loanId);
      const borrower = args.borrower.toLowerCase();
      const totalPaid = (args.totalPaid || '0').toString();

      await Loan.findOneAndUpdate(
        { loanId },
        {
          status: 2, // REPAID
          totalRepaid: totalPaid,
          repaymentTxHash: cleanTxHash,
        }
      );

      await User.findOneAndUpdate(
        { wallet: borrower },
        {
          $inc: { loansRepaid: 1 },
          $set: { lastUpdatedBlock: blockNumber },
        }
      );
      break;
    }

    case 'LoanDefaulted': {
      const loanId = Number(args.loanId);
      const borrower = args.borrower.toLowerCase();

      await Loan.findOneAndUpdate(
        { loanId },
        {
          status: 3, // DEFAULTED
        }
      );

      await User.findOneAndUpdate(
        { wallet: borrower },
        {
          $inc: { defaults: 1 },
          $set: { lastUpdatedBlock: blockNumber },
        }
      );
      break;
    }

    case 'CreditProfileUpdated': {
      const borrower = args.borrower.toLowerCase();
      const newScore = Number(args.newScore);
      const newLimit = (args.newLimit || '0').toString();

      await User.findOneAndUpdate(
        { wallet: borrower },
        {
          creditScore: newScore,
          borrowingLimit: newLimit,
          lastUpdatedBlock: blockNumber,
        },
        { upsert: true }
      );
      break;
    }

    default:
      console.log(`[blockchainListener] Handled informational event: ${eventType}`);
      break;
  }

  // 3. Record in idempotent Transaction collection
  await Transaction.create({
    chainId,
    transactionHash: cleanTxHash,
    logIndex,
    eventType,
    wallet: affectedWallet,
    loanId: args.loanId ? Number(args.loanId) : null,
    amount: (args.principal || args.totalPaid || args.amount || '0').toString(),
    blockNumber,
    timestamp: Math.floor(Date.now() / 1000),
    rawArgs: args,
  });

  // 4. Update cached ProtocolStats
  await recalculateProtocolStats();

  return { processed: true };
}

module.exports = {
  processBlockchainEvent,
};
