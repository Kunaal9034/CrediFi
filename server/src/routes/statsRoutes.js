const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/statsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', getDashboardStats);

module.exports = router;
