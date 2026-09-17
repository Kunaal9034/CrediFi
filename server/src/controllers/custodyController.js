const CustodyEvent = require('../models/CustodyEvent');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const BlockchainService = require('../services/blockchainService');
const { logAudit } = require('../middleware/auditMiddleware');
const { CUSTODY_ACTIONS } = require('../constants/custodyActions');
const { EVIDENCE_STATUS } = require('../constants/evidenceStatus');

/**
 * @route POST /api/evidence/:id/transfer
 * @desc Transfer evidence custody to another officer or specialist
 */
const transferCustody = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recipientUserId, reason, notes } = req.body;

    if (!recipientUserId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Recipient user ID and transfer reason are required'
      });
    }

    const evidence = await Evidence.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { evidenceId: id.toUpperCase() }]
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence not found'
      });
    }

    const recipient = await User.findById(recipientUserId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'Recipient user account not found'
      });
    }

    const previousCustodian = evidence.currentCustodian;
    evidence.currentCustodian = recipient._id;
    evidence.status = EVIDENCE_STATUS.TRANSFERRED;
    await evidence.save();

    // On-Chain Transaction
    let txHash = null;
    if (BlockchainService.isInitialized) {
      try {
        const actorWallet = req.user.walletAddress;
        const toWallet = recipient.walletAddress;
        const onChainRes = await BlockchainService.recordCustodyEventOnChain(
          evidence.evidenceId,
          CUSTODY_ACTIONS.TRANSFERRED,
          actorWallet,
          actorWallet,
          toWallet,
          reason
        );
        txHash = onChainRes.transactionHash;
      } catch (bcErr) {
        console.warn(`[Custody] On-chain transfer recording info: ${bcErr.message}`);
      }
    }

    const custodyEvent = await CustodyEvent.create({
      evidenceId: evidence._id,
      evidenceNumber: evidence.evidenceId,
      caseId: evidence.caseId,
      action: CUSTODY_ACTIONS.TRANSFERRED,
      actor: req.user._id,
      actorRole: req.user.role,
      actorWalletAddress: req.user.walletAddress,
      fromUser: previousCustodian,
      toUser: recipient._id,
      timestamp: new Date(),
      blockchainTx: txHash,
      reason,
      notes: notes || ''
    });

    await logAudit({
      action: 'CUSTODY_TRANSFER',
      actor: req.user,
      resourceType: 'CUSTODY',
      resourceId: evidence.evidenceId,
      blockchainTx: txHash,
      status: 'SUCCESS',
      details: {
        evidenceId: evidence.evidenceId,
        from: previousCustodian,
        to: recipient._id,
        reason
      },
      req
    });

    res.json({
      success: true,
      data: custodyEvent,
      message: `Custody transferred successfully to ${recipient.name} (${recipient.role})`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/evidence/:id/analyze
 * @desc Record forensic analysis event
 */
const recordAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, toolUsed } = req.body;

    const evidence = await Evidence.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { evidenceId: id.toUpperCase() }]
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence not found'
      });
    }

    evidence.status = EVIDENCE_STATUS.UNDER_ANALYSIS;
    await evidence.save();

    const analysisReason = `Forensic Analysis performed: ${notes || 'Digital examination'} (Tool: ${toolUsed || 'Standard Forensics Toolkit'})`;

    let txHash = null;
    if (BlockchainService.isInitialized) {
      try {
        const onChainRes = await BlockchainService.recordCustodyEventOnChain(
          evidence.evidenceId,
          CUSTODY_ACTIONS.ANALYZED,
          req.user.walletAddress,
          null,
          req.user.walletAddress,
          analysisReason
        );
        txHash = onChainRes.transactionHash;
      } catch (bcErr) {
        console.warn(`[Custody] On-chain analysis recording info: ${bcErr.message}`);
      }
    }

    const custodyEvent = await CustodyEvent.create({
      evidenceId: evidence._id,
      evidenceNumber: evidence.evidenceId,
      caseId: evidence.caseId,
      action: CUSTODY_ACTIONS.ANALYZED,
      actor: req.user._id,
      actorRole: req.user.role,
      actorWalletAddress: req.user.walletAddress,
      timestamp: new Date(),
      blockchainTx: txHash,
      reason: analysisReason,
      notes: notes || ''
    });

    await logAudit({
      action: 'FORENSIC_ANALYSIS_RECORDED',
      actor: req.user,
      resourceType: 'EVIDENCE',
      resourceId: evidence.evidenceId,
      blockchainTx: txHash,
      status: 'SUCCESS',
      details: { evidenceId: evidence.evidenceId, toolUsed, notes },
      req
    });

    res.json({
      success: true,
      data: custodyEvent,
      message: 'Forensic analysis logged in chain of custody'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/evidence/:id/custody
 * @desc Retrieve full chronological custody timeline
 */
const getCustodyTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;

    const evidence = await Evidence.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { evidenceId: id.toUpperCase() }]
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence not found'
      });
    }

    const timeline = await CustodyEvent.find({ evidenceId: evidence._id })
      .populate('actor', 'name email badgeNumber role department walletAddress')
      .populate('fromUser', 'name email badgeNumber role')
      .populate('toUser', 'name email badgeNumber role')
      .sort({ timestamp: 1 });

    res.json({
      success: true,
      evidenceId: evidence.evidenceId,
      count: timeline.length,
      data: timeline
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  transferCustody,
  recordAnalysis,
  getCustodyTimeline
};
