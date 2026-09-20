const mongoose = require('mongoose');

const ProtocolStatsSchema = new mongoose.Schema(
  {
    totalUsers: {
      type: Number,
      default: 0,
    },
    totalLoans: {
      type: Number,
      default: 0,
    },
    totalVolume: {
      type: String, // In 6 decimals string
      default: '0',
    },
    activeLoans: {
      type: Number,
      default: 0,
    },
    completedLoans: {
      type: Number,
      default: 0,
    },
    defaultedLoans: {
      type: Number,
      default: 0,
    },
    repaymentRate: {
      type: Number, // Percentage (e.g. 95.5)
      default: 100,
    },
    averageLoanAmount: {
      type: String,
      default: '0',
    },
    averageInterestRate: {
      type: Number, // Basis points
      default: 1000,
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.ProtocolStats || mongoose.model('ProtocolStats', ProtocolStatsSchema);
