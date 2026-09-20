const Loan = require('../models/Loan');
const User = require('../models/User');
const ProtocolStats = require('../models/ProtocolStats');

async function recalculateProtocolStats() {
  try {
    const [totalUsers, loans] = await Promise.all([
      User.countDocuments(),
      Loan.find().lean(),
    ]);

    const totalLoans = loans.length;
    let activeLoans = 0;
    let completedLoans = 0;
    let defaultedLoans = 0;
    let totalVolumeBigInt = 0n;
    let totalInterestRateSum = 0;

    for (const loan of loans) {
      if (loan.status === 1) activeLoans++;
      if (loan.status === 2) completedLoans++;
      if (loan.status === 3) defaultedLoans++;

      totalVolumeBigInt += BigInt(loan.amount || '0');
      totalInterestRateSum += Number(loan.interestRate || 0);
    }

    const settledCount = completedLoans + defaultedLoans;
    const repaymentRate =
      settledCount > 0
        ? Number(((completedLoans / settledCount) * 100).toFixed(1))
        : 100;

    const averageLoanAmount =
      totalLoans > 0
        ? (totalVolumeBigInt / BigInt(totalLoans)).toString()
        : '0';

    const averageInterestRate =
      totalLoans > 0
        ? Math.round(totalInterestRateSum / totalLoans)
        : 1000;

    const stats = {
      totalUsers,
      totalLoans,
      totalVolume: totalVolumeBigInt.toString(),
      activeLoans,
      completedLoans,
      defaultedLoans,
      repaymentRate,
      averageLoanAmount,
      averageInterestRate,
      lastCalculatedAt: new Date(),
    };

    // Persist or update ProtocolStats
    await ProtocolStats.findOneAndUpdate({}, stats, { upsert: true, new: true });
    return stats;
  } catch (err) {
    console.error('[analyticsService] Error recalculating protocol stats:', err);
    return null;
  }
}

module.exports = {
  recalculateProtocolStats,
};
