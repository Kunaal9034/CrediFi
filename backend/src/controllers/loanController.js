const Loan = require('../models/Loan');

exports.getLoans = async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (status !== undefined && status !== '') {
      filter.status = Number(status);
    }

    const [loans, total] = await Promise.all([
      Loan.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      Loan.countDocuments(filter),
    ]);

    res.json({ total, loans });
  } catch (err) {
    console.error('getLoans error:', err);
    res.status(500).json({ error: 'Failed to retrieve loans' });
  }
};

exports.getLoanById = async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findOne({ loanId: Number(loanId) }).lean();
    if (!loan) {
      return res.status(404).json({ error: `Loan #${loanId} not found` });
    }
    res.json({ loan });
  } catch (err) {
    console.error('getLoanById error:', err);
    res.status(500).json({ error: 'Failed to retrieve loan' });
  }
};

exports.getUserLoans = async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const loans = await Loan.find({
      $or: [{ borrower: wallet }, { lender: wallet }],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ total: loans.length, loans });
  } catch (err) {
    console.error('getUserLoans error:', err);
    res.status(500).json({ error: 'Failed to retrieve user loans' });
  }
};
