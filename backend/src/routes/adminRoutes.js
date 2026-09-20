const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// POST /api/admin/backfill
router.post('/backfill', adminController.backfill);

module.exports = router;
