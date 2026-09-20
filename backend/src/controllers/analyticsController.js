const ProtocolStats = require('../models/ProtocolStats');
const { recalculateProtocolStats } = require('../services/analyticsService');

exports.getAnalytics = async (req, res) => {
  try {
    let stats = await ProtocolStats.findOne().lean();
    if (!stats) {
      stats = await recalculateProtocolStats();
    }
    res.json({ stats });
  } catch (err) {
    console.error('getAnalytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
};
