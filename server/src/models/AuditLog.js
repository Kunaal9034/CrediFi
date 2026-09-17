const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    actorEmail: {
      type: String,
      default: 'SYSTEM'
    },
    actorRole: {
      type: String,
      default: 'SYSTEM'
    },
    resourceType: {
      type: String,
      enum: ['USER', 'CASE', 'EVIDENCE', 'CUSTODY', 'CONTRACT', 'SYSTEM', 'AUTH'],
      required: true
    },
    resourceId: {
      type: String,
      default: null
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      required: true
    },
    blockchainTx: {
      type: String,
      default: null
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
