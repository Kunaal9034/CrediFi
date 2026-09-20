const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/:wallet', userController.getUserProfile);
router.get('/transactions/:wallet', userController.getUserTransactions);

module.exports = router;
