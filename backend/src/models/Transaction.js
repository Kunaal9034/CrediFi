const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    chainId: {
      type: Number,
      required: true,
      default: 11155111,
    },
    transactionHash: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    logIndex: {
      type: Number,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'LoanCreated',
        'LoanFunded',
        'LoanRepaid',
        'LoanDefaulted',
        'CreditProfileUpdated',
        'FundsDisbursed',
        'RepaymentTransferred',
      ],
      index: true,
    },
    wallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    loanId: {
      type: Number,
      default: null,
      index: true,
    },
    amount: {
      type: String,
      default: '0',
    },
    blockNumber: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
      default: () => Math.floor(Date.now() / 1000),
    },
    rawArgs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Triple compound unique index for absolute event idempotency
TransactionSchema.index(
  { chainId: 1, transactionHash: 1, logIndex: 1 },
  { unique: true }
);

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
