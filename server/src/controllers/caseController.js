const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const { logAudit } = require('../middleware/auditMiddleware');

/**
 * @route POST /api/cases
 * @desc Create a new investigative case
 */
const createCase = async (req, res, next) => {
  try {
    const { caseId, title, description, incidentDate, assignedPersonnel } = req.body;

    // Check if case ID already exists
    const normalizedCaseId = caseId ? caseId.trim().toUpperCase() : `CASE-${Date.now().toString().slice(-6)}`;
    const existing = await Case.findOne({ caseId: normalizedCaseId });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Case ID '${normalizedCaseId}' already exists in registry`
      });
    }

    const newCase = await Case.create({
      caseId: normalizedCaseId,
      title,
      description,
      incidentDate: incidentDate || new Date(),
      createdBy: req.user._id,
      assignedPersonnel: assignedPersonnel || [req.user._id]
    });

    await logAudit({
      action: 'CASE_CREATE',
      actor: req.user,
      resourceType: 'CASE',
      resourceId: newCase._id.toString(),
      status: 'SUCCESS',
      details: { caseId: newCase.caseId, title: newCase.title },
      req
    });

    res.status(201).json({
      success: true,
      data: newCase
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/cases
 * @desc Get all cases with optional filtering
 */
const getCases = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (search) {
      filter.$or = [
        { caseId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const cases = await Case.find(filter)
      .populate('createdBy', 'name email badgeNumber role')
      .populate('assignedPersonnel', 'name email role')
      .sort({ createdAt: -1 });

    // Append evidence count to each case
    const casesWithStats = await Promise.all(
      cases.map(async (c) => {
        const evidenceCount = await Evidence.countDocuments({ caseId: c._id });
        return {
          ...c.toObject(),
          evidenceCount
        };
      })
    );

    res.json({
      success: true,
      count: casesWithStats.length,
      data: casesWithStats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/cases/:id
 * @desc Get single case by ID or Case Number with its full evidence dossier
 */
const getCaseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const caseDoc = await Case.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { caseId: id.toUpperCase() }]
    })
      .populate('createdBy', 'name email badgeNumber role')
      .populate('assignedPersonnel', 'name email role badgeNumber department');

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Fetch all associated evidence
    const evidenceList = await Evidence.find({ caseId: caseDoc._id })
      .populate('registeredBy', 'name email badgeNumber')
      .populate('currentCustodian', 'name email badgeNumber role')
      .sort({ registeredAt: -1 });

    res.json({
      success: true,
      data: {
        ...caseDoc.toObject(),
        evidenceList
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/cases/:id
 * @desc Update case status or description
 */
const updateCase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, status, assignedPersonnel } = req.body;

    const caseDoc = await Case.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { caseId: id.toUpperCase() }]
    });

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    if (title) caseDoc.title = title;
    if (description) caseDoc.description = description;
    if (status) caseDoc.status = status.toUpperCase();
    if (assignedPersonnel) caseDoc.assignedPersonnel = assignedPersonnel;

    await caseDoc.save();

    await logAudit({
      action: 'CASE_UPDATE',
      actor: req.user,
      resourceType: 'CASE',
      resourceId: caseDoc._id.toString(),
      status: 'SUCCESS',
      details: { caseId: caseDoc.caseId, status: caseDoc.status },
      req
    });

    res.json({
      success: true,
      data: caseDoc
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCase,
  getCases,
  getCaseById,
  updateCase
};
