const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: [true, 'Case ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Case title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Case description is required'],
      trim: true
    },
    incidentDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedPersonnel: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Virtual to populate evidence items belonging to this case
caseSchema.virtual('evidenceList', {
  ref: 'Evidence',
  localField: '_id',
  foreignField: 'caseId'
});

caseSchema.set('toObject', { virtuals: true });
caseSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Case', caseSchema);
