const ProtocolStats = require('../models/ProtocolStats');
const { recalculateProtocolStats } = require('../services/analyticsService');

/**
 * GET /api/analytics
 * Returns protocol-wide indexed aggregated statistics:
 * - totalLoans, activeLoans, repaidLoans, defaultedLoans
 * - totalVolume, totalLent, totalRepaid, totalInterest
 * - repaymentRate, defaultRate
 * - averageLoanAmount, averageInterestRate, averageDurationDays
 * - volumeHistory (time-series checkpoints for Recharts)
 * - creditScoreDistribution (FICO tiers)
 *
 * Query params:
 * - ?refresh=true: Forces re-aggregation across indexed collections
 *
 * NOTE: This endpoint is an indexed view. Smart contracts remain authoritative.
 */
exports.getAnalytics = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    let stats = forceRefresh ? null : await ProtocolStats.findOne().lean();

    if (!stats || !stats.volumeHistory || !stats.creditScoreDistribution) {
      stats = await recalculateProtocolStats();
    }

    res.json({
      stats: stats || {},
      volumeHistory: (stats && stats.volumeHistory) || [],
      creditScoreDistribution: (stats && stats.creditScoreDistribution) || {
        poor: 0,
        fair: 0,
        good: 0,
        excellent: 0,
      },
      _notice: 'Indexed aggregate view. Ethereum Sepolia smart contracts are the sole financial authority.',
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
};
