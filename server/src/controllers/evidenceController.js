const fs = require('fs');
const path = require('path');
const Evidence = require('../models/Evidence');
const Case = require('../models/Case');
const CustodyEvent = require('../models/CustodyEvent');
const HashingService = require('../services/hashingService');
const StorageService = require('../services/storageService');
const BlockchainService = require('../services/blockchainService');
const { logAudit } = require('../middleware/auditMiddleware');
const { CUSTODY_ACTIONS } = require('../constants/custodyActions');
const { EVIDENCE_STATUS } = require('../constants/evidenceStatus');

/**
 * @route POST /api/evidence
 * @desc Register new digital evidence with streaming SHA-256, IPFS pinning, and on-chain registration
 */
const registerEvidence = async (req, res, next) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Evidence file is required'
      });
    }

    tempFilePath = req.file.path;
    const { caseId, title, description, category } = req.body;

    if (!caseId || !title) {
      return res.status(400).json({
        success: false,
        error: 'Case ID and evidence title are required'
      });
    }

    // Validate Case exists
    const caseDoc = await Case.findOne({
      $or: [{ _id: caseId.match(/^[0-9a-fA-F]{24}$/) ? caseId : null }, { caseId: caseId.toUpperCase() }]
    });

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: `Case '${caseId}' not found`
      });
    }

    // 1. Calculate authoritative SHA-256 directly on the backend from the stream
    console.log(`[Evidence] Computing authoritative SHA-256 for ${req.file.originalname}...`);
    const authoritativeSha256 = await HashingService.calculateFileSha256(tempFilePath);
    console.log(`[Evidence] Authoritative SHA-256: ${authoritativeSha256}`);

    // Check if this exact hash is already registered in MongoDB
    const existingEvidenceWithHash = await Evidence.findOne({ sha256: authoritativeSha256 });
    if (existingEvidenceWithHash) {
      return res.status(400).json({
        success: false,
        error: `Identical evidence file already registered under ID '${existingEvidenceWithHash.evidenceId}'`
      });
    }

    // Generate unique Evidence ID e.g. EV-100234
    const evidenceCount = await Evidence.countDocuments();
    const evidenceId = `EV-${String(evidenceCount + 1).padStart(3, '0')}`;

    // 2. Off-chain Storage & IPFS Pinning
    console.log(`[Evidence] Uploading to off-chain IPFS storage...`);
    const { ipfsCid, storagePath, size } = await StorageService.uploadEvidenceFile(
      tempFilePath,
      req.file.originalname,
      authoritativeSha256
    );

    // 3. Register on-chain with Polygon Amoy
    console.log(`[Evidence] Registering hash on Polygon Amoy smart contract...`);
    let blockchainTx = null;
    let blockNumber = null;
    let blockchainStatus = 'PENDING';

    try {
      if (BlockchainService.isReady()) {
        const actorWallet = req.user.walletAddress || undefined;
        const onChainResult = await BlockchainService.registerEvidenceOnChain(
          evidenceId,
          caseDoc.caseId,
          authoritativeSha256,
          ipfsCid,
          actorWallet
        );
        blockchainTx = onChainResult.transactionHash;
        blockNumber = onChainResult.blockNumber;
        blockchainStatus = 'CONFIRMED';
      } else {
        console.log(`[Evidence] Smart contract / operator wallet pending configuration. Evidence recorded with blockchainStatus='PENDING'.`);
      }
    } catch (bcErr) {
      console.warn(`[Evidence] Blockchain write warning: ${bcErr.message}. Storing transaction state as PENDING.`);
      blockchainStatus = 'PENDING';
      blockchainTx = null;
    }

    // 4. Persist in MongoDB
    const newEvidence = await Evidence.create({
      evidenceId,
      caseId: caseDoc._id,
      caseNumber: caseDoc.caseId,
      title,
      description: description || '',
      category: category || 'OTHER',
      filename: path.basename(storagePath),
      originalFilename: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: size,
      sha256: authoritativeSha256,
      ipfsCid,
      storagePath,
      blockchainTx,
      blockNumber,
      contractAddress: BlockchainService.contractAddress,
      blockchainStatus,
      registeredBy: req.user._id,
      currentCustodian: req.user._id,
      status: EVIDENCE_STATUS.REGISTERED,
      registeredAt: new Date()
    });

    // 5. Create initial REGISTERED Custody Event
    await CustodyEvent.create({
      evidenceId: newEvidence._id,
      evidenceNumber: newEvidence.evidenceId,
      caseId: caseDoc._id,
      action: CUSTODY_ACTIONS.REGISTERED,
      actor: req.user._id,
      actorRole: req.user.role,
      actorWalletAddress: req.user.walletAddress,
      toUser: req.user._id,
      timestamp: new Date(),
      blockchainTx,
      reason: 'Initial Evidence Registration & Cryptographic Attestation'
    });

    // 6. Record System Audit Log
    await logAudit({
      action: 'EVIDENCE_REGISTER',
      actor: req.user,
      resourceType: 'EVIDENCE',
      resourceId: newEvidence._id.toString(),
      status: 'SUCCESS',
      blockchainTx,
      details: {
        evidenceId: newEvidence.evidenceId,
        caseNumber: caseDoc.caseId,
        sha256: authoritativeSha256,
        ipfsCid
      },
      req
    });

    res.status(201).json({
      success: true,
      data: newEvidence
    });
  } catch (err) {
    next(err);
  } finally {
    // Clean up temporary upload file if it still exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error('Failed to remove temp upload file:', cleanupErr);
      }
    }
  }
};

/**
 * @route GET /api/evidence
 * @desc Get all evidence with filtering
 */
const getEvidenceList = async (req, res, next) => {
  try {
    const { caseId, category, status, search } = req.query;
    const filter = {};

    if (caseId) {
      const caseDoc = await Case.findOne({
        $or: [{ _id: caseId.match(/^[0-9a-fA-F]{24}$/) ? caseId : null }, { caseId: caseId.toUpperCase() }]
      });
      if (caseDoc) {
        filter.caseId = caseDoc._id;
      }
    }

    if (category) filter.category = category;
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { evidenceId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { sha256: { $regex: search, $options: 'i' } },
        { caseNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const evidenceList = await Evidence.find(filter)
      .populate('caseId', 'caseId title status')
      .populate('registeredBy', 'name email badgeNumber role')
      .populate('currentCustodian', 'name email badgeNumber role')
      .sort({ registeredAt: -1 });

    res.json({
      success: true,
      count: evidenceList.length,
      data: evidenceList
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/evidence/:id
 * @desc Get single evidence record with full on-chain status and custody history
 */
const getEvidenceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const evidence = await Evidence.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { evidenceId: id.toUpperCase() }]
    })
      .populate('caseId', 'caseId title description status incidentDate')
      .populate('registeredBy', 'name email badgeNumber role department')
      .populate('currentCustodian', 'name email badgeNumber role department');

    if (!evidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence not found'
      });
    }

    // Fetch chronological custody trail
    const custodyHistory = await CustodyEvent.find({ evidenceId: evidence._id })
      .populate('actor', 'name email badgeNumber role')
      .populate('fromUser', 'name email badgeNumber role')
      .populate('toUser', 'name email badgeNumber role')
      .sort({ timestamp: 1 });

    // Verify on-chain existence if blockchain service is connected
    let onChainRecord = null;
    try {
      if (BlockchainService.isInitialized) {
        onChainRecord = await BlockchainService.getEvidenceFromChain(evidence.evidenceId);
      }
    } catch (bcErr) {
      console.warn(`[Evidence] On-chain read info: ${bcErr.message}`);
    }

    res.json({
      success: true,
      data: {
        ...evidence.toObject(),
        custodyHistory,
        onChainRecord
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/evidence/:id/download
 * @desc Stream authorized evidence file securely off-chain
 */
const downloadEvidence = async (req, res, next) => {
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

    // Log custody access event
    await CustodyEvent.create({
      evidenceId: evidence._id,
      evidenceNumber: evidence.evidenceId,
      caseId: evidence.caseId,
      action: CUSTODY_ACTIONS.ACCESSED,
      actor: req.user._id,
      actorRole: req.user.role,
      actorWalletAddress: req.user.walletAddress,
      timestamp: new Date(),
      reason: `Evidence file accessed and downloaded for investigation by ${req.user.name} (${req.user.role})`
    });

    await logAudit({
      action: 'EVIDENCE_DOWNLOAD',
      actor: req.user,
      resourceType: 'EVIDENCE',
      resourceId: evidence._id.toString(),
      status: 'SUCCESS',
      details: { evidenceId: evidence.evidenceId, filename: evidence.originalFilename },
      req
    });

    const fileStream = StorageService.getFileStream(evidence.storagePath);

    res.setHeader('Content-Disposition', `attachment; filename="${evidence.originalFilename}"`);
    res.setHeader('Content-Type', evidence.fileType);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/evidence/:id/verify
 * @desc Cryptographically recalculate SHA-256 and compare with on-chain immutable hash
 */
const verifyEvidence = async (req, res, next) => {
  let tempFilePath = null;
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'A verification file must be uploaded to recalculate the SHA-256 hash'
      });
    }

    tempFilePath = req.file.path;

    const evidence = await Evidence.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { evidenceId: id.toUpperCase() }]
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence record not found'
      });
    }

    // 1. Recalculate SHA-256 of the test file on the backend
    console.log(`[Verification] Recalculating SHA-256 of submitted file for ${evidence.evidenceId}...`);
    const computedHash = await HashingService.calculateFileSha256(tempFilePath);
    console.log(`[Verification] Recalculated Hash: ${computedHash}`);
    console.log(`[Verification] Registered Hash:   ${evidence.sha256}`);

    // 2. Fetch immutable hash from Polygon Amoy smart contract if available
    let blockchainHash = evidence.sha256;
    let onChainVerified = false;

    if (BlockchainService.isInitialized) {
      try {
        const onChainData = await BlockchainService.getEvidenceFromChain(evidence.evidenceId);
        if (onChainData && onChainData.sha256Hex) {
          blockchainHash = onChainData.sha256Hex.toLowerCase();
          onChainVerified = true;
        }
      } catch (bcErr) {
        console.warn(`[Verification] Blockchain query warning: ${bcErr.message}. Falling back to indexed hash.`);
      }
    }

    // 3. Strict Comparison
    const isMatch = computedHash.toLowerCase() === blockchainHash.toLowerCase();

    // 4. Update evidence verification status
    evidence.lastVerifiedAt = new Date();
    evidence.lastVerificationStatus = isMatch ? 'MATCH' : 'MISMATCH';
    if (!isMatch) {
      evidence.status = EVIDENCE_STATUS.FLAGGED;
    } else {
      evidence.status = EVIDENCE_STATUS.VERIFIED;
    }
    await evidence.save();

    // 5. Record Custody Verification Event
    let verifyTx = null;
    try {
      if (BlockchainService.isInitialized) {
        const action = isMatch ? CUSTODY_ACTIONS.VERIFIED : CUSTODY_ACTIONS.FLAGGED;
        const reason = isMatch
          ? `Judicial Verification Confirmed: SHA-256 match by ${req.user.name} (${req.user.role})`
          : `CRITICAL ALERT: Hash mismatch detected during verification by ${req.user.name} (${req.user.role})`;

        const onChainCustody = await BlockchainService.recordCustodyEventOnChain(
          evidence.evidenceId,
          action,
          req.user.walletAddress,
          null,
          null,
          reason
        );
        verifyTx = onChainCustody.transactionHash;
      }
    } catch (bcCustodyErr) {
      console.warn(`[Verification] On-chain custody write warning: ${bcCustodyErr.message}`);
    }

    await CustodyEvent.create({
      evidenceId: evidence._id,
      evidenceNumber: evidence.evidenceId,
      caseId: evidence.caseId,
      action: isMatch ? CUSTODY_ACTIONS.VERIFIED : CUSTODY_ACTIONS.FLAGGED,
      actor: req.user._id,
      actorRole: req.user.role,
      actorWalletAddress: req.user.walletAddress,
      timestamp: new Date(),
      blockchainTx: verifyTx,
      reason: isMatch
        ? `Verification Confirmed: SHA-256 cryptographic match by ${req.user.name} (${req.user.role})`
        : `CRITICAL INTEGRITY FAILURE: SHA-256 hash mismatch! Evidence may have been tampered or corrupted.`,
      verificationDetails: {
        computedHash,
        blockchainHash,
        isMatch
      }
    });

    await logAudit({
      action: isMatch ? 'EVIDENCE_VERIFY_SUCCESS' : 'EVIDENCE_VERIFY_MISMATCH',
      actor: req.user,
      resourceType: 'EVIDENCE',
      resourceId: evidence._id.toString(),
      status: isMatch ? 'SUCCESS' : 'FAILURE',
      blockchainTx: verifyTx,
      details: {
        evidenceId: evidence.evidenceId,
        computedHash,
        blockchainHash,
        isMatch
      },
      req
    });

    res.json({
      success: true,
      verificationResult: {
        evidenceId: evidence.evidenceId,
        filename: req.file.originalname,
        originalHash: blockchainHash,
        recalculatedHash: computedHash,
        isMatch,
        status: isMatch ? 'VERIFIED' : 'FAILED',
        badge: isMatch ? 'HASH MATCH' : 'HASH MISMATCH',
        onChainVerified,
        verifiedBy: {
          name: req.user.name,
          role: req.user.role,
          badgeNumber: req.user.badgeNumber
        },
        verifiedAt: new Date(),
        message: isMatch
          ? 'Cryptographic integrity verified: The submitted file exactly matches the immutable on-chain record.'
          : 'INTEGRITY ALERT: Recalculated hash does not match the immutable registered hash! File content has been modified.'
      }
    });
  } catch (err) {
    next(err);
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error('Failed to remove temp verification file:', cleanupErr);
      }
    }
  }
};

module.exports = {
  registerEvidence,
  getEvidenceList,
  getEvidenceById,
  downloadEvidence,
  verifyEvidence
};
