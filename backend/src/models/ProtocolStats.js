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
      type: String, // In 6 decimals string (USDC)
      default: '0',
    },
    totalLent: {
      type: String, // Total volume funded
      default: '0',
    },
    totalRepaid: {
      type: String, // Total principal/interest repaid
      default: '0',
    },
    totalInterest: {
      type: String, // Total interest earned
      default: '0',
    },
    activeLoans: {
      type: Number,
      default: 0,
    },
    repaidLoans: {
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
    defaultRate: {
      type: Number, // Percentage (e.g. 4.5)
      default: 0,
    },
    lastIndexedBlock: {
      type: Number,
      default: 0,
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

// Keep completedLoans and repaidLoans in sync
ProtocolStatsSchema.pre('save', function (next) {
  if (this.repaidLoans && !this.completedLoans) {
    this.completedLoans = this.repaidLoans;
  } else if (this.completedLoans && !this.repaidLoans) {
    this.repaidLoans = this.completedLoans;
  }
  next();
});

module.exports = mongoose.models.ProtocolStats || mongoose.model('ProtocolStats', ProtocolStatsSchema);

