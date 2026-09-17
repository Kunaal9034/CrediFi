const express = require('express');
const router = express.Router();
const {
  registerEvidence,
  getEvidenceList,
  getEvidenceById,
  downloadEvidence,
  verifyEvidence
} = require('../controllers/evidenceController');
const {
  transferCustody,
  recordAnalysis,
  getCustodyTimeline
} = require('../controllers/custodyController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/rbacMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { ROLES } = require('../constants/roles');

router.use(protect);

// Registration & Retrieval
router.post('/', authorize(ROLES.ADMIN, ROLES.OFFICER), upload.single('file'), registerEvidence);
router.get('/', getEvidenceList);
router.get('/:id', getEvidenceById);
router.get('/:id/download', downloadEvidence);

// Verification (Judges, Prosecutors, Officers, Forensics, Admins)
router.post('/:id/verify', upload.single('file'), verifyEvidence);

// Custody operations
router.post('/:id/transfer', authorize(ROLES.ADMIN, ROLES.OFFICER), transferCustody);
router.post('/:id/analyze', authorize(ROLES.ADMIN, ROLES.FORENSIC), recordAnalysis);
router.get('/:id/custody', getCustodyTimeline);

module.exports = router;
