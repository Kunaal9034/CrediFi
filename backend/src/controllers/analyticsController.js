const ProtocolStats = require('../models/ProtocolStats');
const { recalculateProtocolStats } = require('../services/analyticsService');

/**
 * GET /api/analytics
 * Returns protocol-wide indexed aggregated statistics:
 * - totalLoans, activeLoans, repaidLoans, defaultedLoans
 * - totalVolume, totalLent, totalRepaid, totalInterest
 * - repaymentRate, defaultRate
 * - averageLoanAmount, averageInterestRate
 *
 * NOTE: This endpoint is an indexed view. Smart contracts remain authoritative.
 */
exports.getAnalytics = async (req, res) => {
  try {
    let stats = await ProtocolStats.findOne().lean();
    if (!stats) {
      stats = await recalculateProtocolStats();
    }
    res.json({
      stats,
      _notice: 'Indexed aggregate view. Ethereum Sepolia smart contracts are the sole financial authority.',
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
};
