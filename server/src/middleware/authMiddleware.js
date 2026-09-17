const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed: No token provided'
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'justicevault_default_jwt_secret_dev';
    const decoded = jwt.verify(token, jwtSecret);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed: User account no longer exists'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Authentication failed: User account has been deactivated'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed: Token is invalid or expired'
    });
  }
};

module.exports = {
  protect
};
