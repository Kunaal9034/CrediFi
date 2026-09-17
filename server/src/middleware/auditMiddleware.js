const AuditLog = require('../models/AuditLog');

/**
 * Log an audit entry into the database
 */
const logAudit = async ({
  action,
  actor = null,
  resourceType,
  resourceId = null,
  status = 'SUCCESS',
  blockchainTx = null,
  details = {},
  req = null
}) => {
  try {
    let actorId = actor ? actor._id || actor.id : null;
    let actorEmail = actor ? actor.email : 'SYSTEM';
    let actorRole = actor ? actor.role : 'SYSTEM';

    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      userAgent = req.headers['user-agent'] || '';
      if (!actorId && req.user) {
        actorId = req.user._id;
        actorEmail = req.user.email;
        actorRole = req.user.role;
      }
    }

    await AuditLog.create({
      action,
      actor: actorId,
      actorEmail,
      actorRole,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      status,
      blockchainTx,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err.message);
  }
};

module.exports = {
  logAudit
};
