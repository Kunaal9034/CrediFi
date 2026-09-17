const express = require('express');
const router = express.Router();
const BlockchainService = require('../services/blockchainService');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

/**
 * @route GET /api/blockchain/:evidenceId
 * @desc Get on-chain evidence record directly from Polygon Amoy contract
 */
router.get('/:evidenceId', async (req, res, next) => {
  try {
    const { evidenceId } = req.params;
    const onChainRecord = await BlockchainService.getEvidenceFromChain(evidenceId);
    res.json({
      success: true,
      data: onChainRecord
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/blockchain/tx/:txHash
 * @desc Inspect transaction receipt directly from the blockchain
 */
router.get('/tx/:txHash', async (req, res, next) => {
  try {
    const { txHash } = req.params;
    const receipt = await BlockchainService.getTransactionReceipt(txHash);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Transaction receipt not found on chain'
      });
    }
    res.json({
      success: true,
      data: receipt
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
