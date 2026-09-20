const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

router.get('/', loanController.getLoans);
router.get('/user/:wallet', loanController.getUserLoans);
router.get('/:loanId', loanController.getLoanById);

module.exports = router;
