const express = require('express');
const router = express.Router();
const { register, login, getMe, getNonce, verifySignature } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/nonce', getNonce);
router.post('/verify-signature', verifySignature);

module.exports = router;
