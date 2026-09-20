const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();

const loanRoutes = require('./routes/loanRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const userController = require('./controllers/userController');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Utility Middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

// Express JSON body parser with rawBody preservation for HMAC signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check Endpoint (Section 15)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  res.status(200).json({
    status: 'ok',
    service: 'CrediFi Backend API',
    network: 'Ethereum Sepolia',
    chainId: process.env.CHAIN_ID || 11155111,
    database: dbStatusMap[dbState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Root Information Endpoint
app.get('/', (req, res) => {
  res.json({
    project: 'CrediFi',
    tagline: 'Onchain Credit. Undercollateralized Lending.',
    hackathon: "Hack in Hills '26",
    healthCheck: '/api/health',
    documentation: '/docs',
  });
});

// REST API Routes
app.use('/api/loans', loanRoutes);
app.use('/api/users', userRoutes);
app.get('/api/transactions/:wallet', userController.getUserTransactions);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// MongoDB Connection
if (process.env.MONGO_URI && process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('[CrediFi Backend] Connected to MongoDB cache');
    })
    .catch((err) => {
      console.warn('[CrediFi Backend] MongoDB connection failed (running in cache-degraded mode):', err.message);
    });
}

// Start Server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CrediFi Backend] Server running on port ${PORT}`);
    console.log(`[CrediFi Backend] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[CrediFi Backend] Alchemy webhook: http://localhost:${PORT}/api/webhooks/alchemy`);
  });
}

module.exports = app;
