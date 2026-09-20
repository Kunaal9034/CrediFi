const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema(
  {
    loanId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    borrower: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    lender: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      index: true,
    },
    amount: {
      type: String, // Stored as string to preserve exact uint256 precision
      required: true,
    },
    interestRate: {
      type: Number, // Basis points (e.g. 1000 = 10%)
      required: true,
    },
    duration: {
      type: Number, // Seconds
      required: true,
    },
    status: {
      type: Number, // 0: REQUESTED, 1: ACTIVE, 2: REPAID, 3: DEFAULTED
      required: true,
      default: 0,
      index: true,
    },
    startTime: {
      type: Number,
      default: 0,
    },
    dueDate: {
      type: Number,
      default: 0,
    },
    totalRepaid: {
      type: String,
      default: '0',
    },
    creationTxHash: {
      type: String,
      required: true,
    },
    fundingTxHash: {
      type: String,
      default: null,
    },
    repaymentTxHash: {
      type: String,
      default: null,
    },
    blockNumber: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Loan || mongoose.model('Loan', LoanSchema);
