const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    wallet: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    creditScore: {
      type: Number,
      default: 500,
      index: true,
    },
    borrowingLimit: {
      type: String,
      default: '500000000', // 500 USDC in 6 decimals
    },
    outstandingPrincipal: {
      type: String, // String representation for 6-decimal USDC precision
      default: '0',
    },
    loansTaken: {
      type: Number,
      default: 0,
    },
    loansRepaid: {
      type: Number,
      default: 0,
    },
    defaults: {
      type: Number,
      default: 0,
    },
    totalBorrowed: {
      type: String,
      default: '0',
    },
    totalRepaid: {
      type: String,
      default: '0',
    },
    totalLent: {
      type: String,
      default: '0',
    },
    totalInterestEarned: {
      type: String,
      default: '0',
    },
    lastIndexedBlock: {
      type: Number,
      default: 0,
    },
    lastUpdatedBlock: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Keep lastIndexedBlock and lastUpdatedBlock in sync
UserSchema.pre('save', function (next) {
  if (this.lastIndexedBlock && !this.lastUpdatedBlock) {
    this.lastUpdatedBlock = this.lastIndexedBlock;
  } else if (this.lastUpdatedBlock && !this.lastIndexedBlock) {
    this.lastIndexedBlock = this.lastUpdatedBlock;
  }
  next();
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

