const Loan = require('../models/Loan');
const User = require('../models/User');
const ProtocolStats = require('../models/ProtocolStats');

async function recalculateProtocolStats(currentBlock = 0) {
  try {
    const [totalUsers, loans] = await Promise.all([
      User.countDocuments(),
      Loan.find().lean(),
    ]);

    const totalLoans = loans.length;
    let activeLoans = 0;
    let repaidLoans = 0;
    let defaultedLoans = 0;
    let totalVolumeBigInt = 0n;
    let totalLentBigInt = 0n;
    let totalRepaidBigInt = 0n;
    let totalInterestBigInt = 0n;
    let totalInterestRateSum = 0;
    let maxBlock = currentBlock;

    for (const loan of loans) {
      const principalStr = loan.principal || loan.amount || '0';
      const principalBigInt = BigInt(principalStr);
      totalVolumeBigInt += principalBigInt;
      totalInterestRateSum += Number(loan.interestRateBps || loan.interestRate || 0);

      if (loan.blockNumber && loan.blockNumber > maxBlock) {
        maxBlock = loan.blockNumber;
      }

      if (loan.status === 1) {
        // ACTIVE
        activeLoans++;
        totalLentBigInt += principalBigInt;
      } else if (loan.status === 2) {
        // REPAID
        repaidLoans++;
        totalLentBigInt += principalBigInt;
        const repaidAmount = BigInt(loan.totalRepaid || loan.totalDue || principalStr);
        totalRepaidBigInt += repaidAmount;
        if (repaidAmount > principalBigInt) {
          totalInterestBigInt += repaidAmount - principalBigInt;
        }
      } else if (loan.status === 3) {
        // DEFAULTED
        defaultedLoans++;
        totalLentBigInt += principalBigInt;
      }
    }

    const settledCount = repaidLoans + defaultedLoans;
    const repaymentRate =
      settledCount > 0
        ? Number(((repaidLoans / settledCount) * 100).toFixed(1))
        : 100;

    const defaultRate =
      settledCount > 0
        ? Number(((defaultedLoans / settledCount) * 100).toFixed(1))
        : 0;

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
      activeLoans,
      repaidLoans,
      completedLoans: repaidLoans,
      defaultedLoans,
      totalVolume: totalVolumeBigInt.toString(),
      totalLent: totalLentBigInt.toString(),
      totalRepaid: totalRepaidBigInt.toString(),
      totalInterest: totalInterestBigInt.toString(),
      repaymentRate,
      defaultRate,
      lastIndexedBlock: maxBlock,
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

