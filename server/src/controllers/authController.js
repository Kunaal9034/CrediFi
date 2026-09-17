const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const User = require('../models/User');
const { logAudit } = require('../middleware/auditMiddleware');

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || 'justicevault_default_jwt_secret_dev';
  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

/**
 * @route POST /api/auth/register
 * @desc Register a new user account
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, badgeNumber, department, walletAddress } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email address already exists'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'OFFICER',
      badgeNumber: badgeNumber || '',
      department: department || 'Digital Forensics & Law Enforcement',
      walletAddress: walletAddress ? walletAddress.toLowerCase() : null
    });

    const token = generateToken(user._id);

    await logAudit({
      action: 'USER_REGISTER',
      actor: user,
      resourceType: 'USER',
      resourceId: user._id.toString(),
      status: 'SUCCESS',
      details: { email: user.email, role: user.role },
      req
    });

    res.status(201).json({
      success: true,
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get token
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email and password'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      await logAudit({
        action: 'LOGIN_FAILURE',
        resourceType: 'AUTH',
        status: 'FAILURE',
        details: { email, reason: 'User not found' },
        req
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await logAudit({
        action: 'LOGIN_FAILURE',
        actor: user,
        resourceType: 'AUTH',
        status: 'FAILURE',
        details: { email, reason: 'Incorrect password' },
        req
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated. Contact system administrator.'
      });
    }

    const token = generateToken(user._id);

    await logAudit({
      action: 'LOGIN_SUCCESS',
      actor: user,
      resourceType: 'AUTH',
      status: 'SUCCESS',
      details: { email: user.email, role: user.role },
      req
    });

    res.json({
      success: true,
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/auth/me
 * @desc Get authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: user.toSafeObject()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/nonce
 * @desc Generate a cryptographic nonce for MetaMask wallet authentication
 */
const getNonce = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Valid Ethereum wallet address is required'
      });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const nonce = `JusticeVault Sign-In Verification: ${crypto.randomBytes(16).toString('hex')} [Timestamp: ${Date.now()}]`;

    // If user is authenticated, attach nonce to their record
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { nonce, walletAddress: normalizedAddress });
    }

    res.json({
      success: true,
      nonce,
      walletAddress: normalizedAddress
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/verify-signature
 * @desc Verify cryptographic signature from MetaMask
 */
const verifySignature = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address, signature, and message are required'
      });
    }

    // Recover address from signature using ethers
    const recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();

    if (recoveredAddress !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Cryptographic signature verification failed: Signer does not match provided address'
      });
    }

    // Link wallet to authenticated user
    let user = req.user;
    if (user) {
      user.walletAddress = recoveredAddress;
      user.nonce = null;
      await user.save();
    }

    await logAudit({
      action: 'WALLET_SIGNATURE_VERIFIED',
      actor: user || null,
      resourceType: 'AUTH',
      status: 'SUCCESS',
      details: { walletAddress: recoveredAddress },
      req
    });

    res.json({
      success: true,
      verified: true,
      walletAddress: recoveredAddress,
      message: 'Cryptographic signature authenticated successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  getNonce,
  verifySignature
};
