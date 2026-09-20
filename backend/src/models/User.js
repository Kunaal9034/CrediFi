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
    },
    borrowingLimit: {
      type: String,
      default: '500000000', // 500 USDC in 6 decimals
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
    lastUpdatedBlock: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
