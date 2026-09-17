const express = require('express');
const router = express.Router();
const { createCase, getCases, getCaseById, updateCase } = require('../controllers/caseController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../constants/roles');

router.use(protect);

router.post('/', authorize(ROLES.ADMIN, ROLES.OFFICER), createCase);
router.get('/', getCases);
router.get('/:id', getCaseById);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.OFFICER), updateCase);

module.exports = router;
