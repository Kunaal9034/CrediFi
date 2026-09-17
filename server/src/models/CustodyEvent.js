const mongoose = require('mongoose');
const { CUSTODY_ACTIONS } = require('../constants/custodyActions');

const custodyEventSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true,
      index: true
    },
    evidenceNumber: {
      type: String,
      required: true,
      index: true
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true
    },
    action: {
      type: String,
      enum: Object.values(CUSTODY_ACTIONS),
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actorRole: {
      type: String,
      required: true
    },
    actorWalletAddress: {
      type: String,
      lowercase: true,
      default: null
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    blockchainTx: {
      type: String,
      default: null,
      index: true
    },
    blockchainLogIndex: {
      type: Number,
      default: 0
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    notes: {
      type: String,
      default: ''
    },
    verificationDetails: {
      computedHash: { type: String, default: null },
      blockchainHash: { type: String, default: null },
      isMatch: { type: Boolean, default: null }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CustodyEvent', custodyEventSchema);
