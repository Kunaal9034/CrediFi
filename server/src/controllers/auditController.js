const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

/**
 * @route GET /api/audit
 * @desc Get system audit logs (Admin only)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, resourceType, status, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(filter)
      .populate('actor', 'name email role badgeNumber')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: logs
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/users
 * @desc List all system users (Admin only)
 */
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/users/:id/role
 * @desc Update user role (Admin only)
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      data: user.toSafeObject(),
      message: `User role updated to ${role}`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
  getUsers,
  updateUserRole
};
