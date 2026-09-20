const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Utility Middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check Endpoint (Section 15)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'CrediFi Backend API',
    network: 'Ethereum Sepolia',
    chainId: process.env.CHAIN_ID || 11155111,
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    project: 'CrediFi',
    tagline: 'Onchain Credit. Undercollateralized Lending.',
    hackathon: "Hack in Hills '26",
    healthCheck: '/api/health',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start listening if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CrediFi Backend] Server running on port ${PORT}`);
    console.log(`[CrediFi Backend] Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
