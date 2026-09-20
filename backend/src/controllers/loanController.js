const Loan = require('../models/Loan');
const Transaction = require('../models/Transaction');

/**
 * GET /api/loans
 * Query params:
 * - status: 0 (REQUESTED), 1 (ACTIVE), 2 (REPAID), 3 (DEFAULTED)
 * - borrower: wallet address
 * - lender: wallet address
 * - limit: max records per page (default 50, max 100)
 * - page: page number (1-indexed, default 1)
 * - skip: skip count (alternative to page)
 *
 * NOTE: This endpoint provides an indexed read-optimized view from MongoDB.
 * It is NOT an authorization source.
 */
exports.getLoans = async (req, res) => {
  try {
    const { status, borrower, lender, limit = 50, page = 1, skip } = req.query;
    const filter = {};

    if (status !== undefined && status !== '') {
      filter.status = Number(status);
    }
    if (borrower) {
      filter.borrower = borrower.toLowerCase().trim();
    }
    if (lender) {
      filter.lender = lender.toLowerCase().trim();
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedSkip = skip !== undefined ? Math.max(Number(skip), 0) : (parsedPage - 1) * parsedLimit;

    const [loans, total] = await Promise.all([
      Loan.find(filter)
        .sort({ createdAt: -1 })
        .skip(parsedSkip)
        .limit(parsedLimit)
        .lean(),
      Loan.countDocuments(filter),
    ]);

    res.json({
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
      loans,
      _notice: 'Indexed read-optimized view. Ethereum Sepolia smart contracts are the sole financial authority.',
    });
  } catch (err) {
    console.error('getLoans error:', err);
    res.status(500).json({ error: 'Failed to retrieve loans' });
  }
};

/**
 * GET /api/loans/:id or /api/loans/:loanId
 * Returns the indexed loan and its related transaction history
 */
exports.getLoanById = async (req, res) => {
  try {
    const idParam = req.params.id || req.params.loanId;
    const numericLoanId = Number(idParam);

    if (isNaN(numericLoanId)) {
      return res.status(400).json({ error: `Invalid loanId: ${idParam}` });
    }

    const loan = await Loan.findOne({ loanId: numericLoanId }).lean();
    if (!loan) {
      return res.status(404).json({ error: `Loan #${numericLoanId} not found in index` });
    }

    // Retrieve associated transactions for audit trail
    const transactions = await Transaction.find({ loanId: numericLoanId })
      .sort({ blockNumber: 1, logIndex: 1 })
      .lean();

    res.json({
      loan,
      transactions,
      _notice: 'Indexed read-optimized view. Ethereum Sepolia smart contracts are the sole financial authority.',
    });
  } catch (err) {
    console.error('getLoanById error:', err);
    res.status(500).json({ error: 'Failed to retrieve loan' });
  }
};

/**
 * GET /api/loans/user/:wallet
 * Returns all loans where the wallet is borrower or lender
 */
exports.getUserLoans = async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    const loans = await Loan.find({
      $or: [{ borrower: wallet }, { lender: wallet }],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      total: loans.length,
      loans,
      _notice: 'Indexed read-optimized view. Ethereum Sepolia smart contracts are the sole financial authority.',
    });
  } catch (err) {
    console.error('getUserLoans error:', err);
    res.status(500).json({ error: 'Failed to retrieve user loans' });
  }
};
