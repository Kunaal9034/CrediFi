const express = require('express');
const router = express.Router();
const { getAuditLogs, getUsers, updateUserRole } = require('../controllers/auditController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../constants/roles');

router.use(protect);
router.use(authorize(ROLES.ADMIN));

router.get('/', getAuditLogs);
router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);

module.exports = router;
