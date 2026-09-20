const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * GET /api/users/:wallet
 * Returns cached/indexed credit profile and loan statistics
 *
 * NOTE: Indexed read-optimized view from MongoDB.
 * It is NOT an authorization source. CreditRegistry on Sepolia is authoritative.
 */
exports.getUserProfile = async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    let user = await User.findOne({ wallet }).lean();

    if (!user) {
      // Default baseline profile for new / unindexed address
      user = {
        wallet,
        creditScore: 500,
        borrowingLimit: '500000000',
        outstandingPrincipal: '0',
        loansTaken: 0,
        loansRepaid: 0,
        defaults: 0,
        totalBorrowed: '0',
        totalRepaid: '0',
        totalLent: '0',
        totalInterestEarned: '0',
        lastIndexedBlock: 0,
      };
    }

    const recentTransactions = await Transaction.find({ wallet })
      .sort({ blockNumber: -1, createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      user,
      recentTransactions,
      _notice: 'Indexed read-optimized view. CreditRegistry on Sepolia is authoritative.',
    });
  } catch (err) {
    console.error('getUserProfile error:', err);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
};

/**
 * GET /api/transactions/:wallet
 * Returns recent transaction audit records for a wallet
 */
exports.getUserTransactions = async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    const transactions = await Transaction.find({ wallet })
      .sort({ blockNumber: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      total: transactions.length,
      transactions,
      _notice: 'Indexed read-optimized view. Ethereum Sepolia smart contracts are the sole financial authority.',
    });
  } catch (err) {
    console.error('getUserTransactions error:', err);
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
};
