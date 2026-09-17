const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const CustodyEvent = require('../models/CustodyEvent');
const { EVIDENCE_STATUS } = require('../constants/evidenceStatus');

/**
 * @route GET /api/stats
 * @desc Get accurate, aggregate dashboard metrics from the real database
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const activeCases = await Case.countDocuments({ status: 'ACTIVE' });
    const totalCases = await Case.countDocuments();
    const totalEvidence = await Evidence.countDocuments();
    const verifiedEvidence = await Evidence.countDocuments({ status: EVIDENCE_STATUS.VERIFIED });
    const flaggedEvidence = await Evidence.countDocuments({ status: EVIDENCE_STATUS.FLAGGED });
    const inCustodyEvidence = await Evidence.countDocuments({ status: EVIDENCE_STATUS.IN_CUSTODY });
    const transferredEvidence = await Evidence.countDocuments({ status: EVIDENCE_STATUS.TRANSFERRED });
    const underAnalysisEvidence = await Evidence.countDocuments({ status: EVIDENCE_STATUS.UNDER_ANALYSIS });

    // Recent 10 evidence items
    const recentEvidence = await Evidence.find()
      .populate('caseId', 'caseId title')
      .populate('registeredBy', 'name role')
      .sort({ registeredAt: -1 })
      .limit(10);

    // Recent 10 custody events
    const recentEvents = await CustodyEvent.find()
      .populate('actor', 'name role')
      .populate('evidenceId', 'evidenceId title filename')
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        metrics: {
          activeCases,
          totalCases,
          totalEvidence,
          verifiedEvidence,
          flaggedEvidence,
          inCustodyEvidence,
          transferredEvidence,
          underAnalysisEvidence
        },
        recentEvidence,
        recentEvents
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats
};
