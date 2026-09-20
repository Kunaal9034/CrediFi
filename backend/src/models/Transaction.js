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
    contractAddress: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      index: true,
    },
    eventName: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      index: true,
    },
    wallet: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      default: null,
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
      index: true,
    },
    blockTimestamp: {
      type: Number,
      default: () => Math.floor(Date.now() / 1000),
    },
    timestamp: {
      type: Number,
      default: () => Math.floor(Date.now() / 1000),
    },
    args: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rawArgs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    idempotencyKey: {
      type: String,
      unique: true,
      index: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
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

// Pre-save hook to ensure fields stay in sync
TransactionSchema.pre('save', function (next) {
  if (this.eventName && !this.eventType) {
    this.eventType = this.eventName;
  } else if (this.eventType && !this.eventName) {
    this.eventName = this.eventType;
  }

  if (this.blockTimestamp && !this.timestamp) {
    this.timestamp = this.blockTimestamp;
  } else if (this.timestamp && !this.blockTimestamp) {
    this.blockTimestamp = this.timestamp;
  }

  if (this.args && (!this.rawArgs || Object.keys(this.rawArgs).length === 0)) {
    this.rawArgs = this.args;
  } else if (this.rawArgs && (!this.args || Object.keys(this.args).length === 0)) {
    this.args = this.rawArgs;
  }

  if (!this.idempotencyKey) {
    this.idempotencyKey = `${this.chainId}:${this.transactionHash.toLowerCase()}:${this.logIndex}`;
  }

  next();
});

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

