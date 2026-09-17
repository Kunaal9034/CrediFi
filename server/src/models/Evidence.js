const mongoose = require('mongoose');
const { EVIDENCE_STATUS, EVIDENCE_CATEGORIES } = require('../constants/evidenceStatus');

const evidenceSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: String,
      required: [true, 'Evidence ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: [true, 'Case reference is required'],
      index: true
    },
    caseNumber: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Evidence title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: Object.values(EVIDENCE_CATEGORIES),
      default: EVIDENCE_CATEGORIES.OTHER,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    originalFilename: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    sha256: {
      type: String,
      required: [true, 'SHA-256 hash is required'],
      lowercase: true,
      length: 64,
      index: true
    },
    ipfsCid: {
      type: String,
      required: true
    },
    storagePath: {
      type: String,
      required: true
    },
    
    // Blockchain verification metadata
    blockchainTx: {
      type: String,
      required: true,
      index: true
    },
    blockNumber: {
      type: Number,
      default: null
    },
    contractAddress: {
      type: String,
      default: null
    },
    blockchainStatus: {
      type: String,
      enum: ['CONFIRMED', 'PENDING', 'FAILED'],
      default: 'CONFIRMED'
    },
    
    // Custodial tracking
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    currentCustodian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: Object.values(EVIDENCE_STATUS),
      default: EVIDENCE_STATUS.REGISTERED,
      index: true
    },
    lastVerifiedAt: {
      type: Date,
      default: null
    },
    lastVerificationStatus: {
      type: String,
      enum: ['MATCH', 'MISMATCH', 'NONE'],
      default: 'NONE'
    }
  },
  {
    timestamps: true
  }
);

// Virtual to populate custody history
evidenceSchema.virtual('custodyHistory', {
  ref: 'CustodyEvent',
  localField: '_id',
  foreignField: 'evidenceId',
  options: { sort: { timestamp: 1 } }
});

evidenceSchema.set('toObject', { virtuals: true });
evidenceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Evidence', evidenceSchema);
