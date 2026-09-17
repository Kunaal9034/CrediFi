/**
 * Restrict route access to specific roles.
 * Must be used after authMiddleware.protect
 * @param  {...string} allowedRoles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User is not authenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role '${req.user.role}' does not have permission to perform this action. Allowed roles: [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
};

module.exports = {
  authorize
};
