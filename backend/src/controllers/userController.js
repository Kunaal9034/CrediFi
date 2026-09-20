const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.getUserProfile = async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    let user = await User.findOne({ wallet }).lean();

    if (!user) {
      // Default baseline profile
      user = {
        wallet,
        creditScore: 500,
        borrowingLimit: '500000000',
        loansTaken: 0,
        loansRepaid: 0,
        defaults: 0,
        totalBorrowed: '0',
        totalRepaid: '0',
      };
    }

    const recentTransactions = await Transaction.find({ wallet })
      .sort({ blockNumber: -1, createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      user,
      recentTransactions,
    });
  } catch (err) {
    console.error('getUserProfile error:', err);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
};

exports.getUserTransactions = async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const transactions = await Transaction.find({ wallet })
      .sort({ blockNumber: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ total: transactions.length, transactions });
  } catch (err) {
    console.error('getUserTransactions error:', err);
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
};
