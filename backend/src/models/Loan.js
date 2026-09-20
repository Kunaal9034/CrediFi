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
    principal: {
      type: String, // String representation for 6-decimal USDC precision
      default: '0',
    },
    amount: {
      type: String, // Kept in sync with principal for backwards compatibility
      default: '0',
    },
    interestRateBps: {
      type: Number, // Basis points (e.g. 500 = 5.00%)
      default: 0,
    },
    interestRate: {
      type: Number, // Kept in sync with interestRateBps
      default: 0,
    },
    duration: {
      type: Number, // Seconds
      required: true,
    },
    totalDue: {
      type: String, // String representation for exact precision
      default: '0',
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
    fundedAt: {
      type: Number, // Unix timestamp in seconds
      default: 0,
    },
    dueDate: {
      type: Number,
      default: 0,
    },
    repaidAt: {
      type: Number,
      default: 0,
    },
    defaultedAt: {
      type: Number,
      default: 0,
    },
    totalRepaid: {
      type: String,
      default: '0',
    },
    creationTxHash: {
      type: String,
      default: null,
    },
    fundingTxHash: {
      type: String,
      default: null,
    },
    repaymentTxHash: {
      type: String,
      default: null,
    },
    defaultTxHash: {
      type: String,
      default: null,
    },
    blockNumber: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes required by Phase 13 spec:
// loanId, borrower, lender, status, borrower + status, createdAt
LoanSchema.index({ borrower: 1, status: 1 });
LoanSchema.index({ lender: 1, status: 1 });
LoanSchema.index({ createdAt: -1 });

// Pre-save hook to ensure amount and principal, interestRate and interestRateBps stay synced
LoanSchema.pre('save', function (next) {
  if (this.principal && (!this.amount || this.amount === '0')) {
    this.amount = this.principal;
  } else if (this.amount && (!this.principal || this.principal === '0')) {
    this.principal = this.amount;
  }
  if (this.interestRateBps && !this.interestRate) {
    this.interestRate = this.interestRateBps;
  } else if (this.interestRate && !this.interestRateBps) {
    this.interestRateBps = this.interestRate;
  }
  next();
});

module.exports = mongoose.models.Loan || mongoose.model('Loan', LoanSchema);

