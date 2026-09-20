const crypto = require('crypto');
const { processBlockchainEvent, isContractAllowed, EXPECTED_CHAIN_ID } = require('../services/eventProcessor');

/**
 * Validates HMAC SHA-256 signature using constant-time comparison
 */
function isValidAlchemySignature(rawBody, signature, signingKey) {
  if (!signature || typeof signature !== 'string') return false;
  if (!signingKey) return false;

  try {
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(rawBody);
    const digest = hmac.digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const digestBuf = Buffer.from(digest, 'utf8');

    if (sigBuf.length !== digestBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, digestBuf);
  } catch (err) {
    console.error('[webhookController] Signature verification error:', err.message);
    return false;
  }
}

/**
 * Handles incoming Alchemy webhooks
 * Flow:
 * 1. Raw body capture
 * 2. HMAC verification (constant-time)
 * 3. JSON parsing
 * 4. ChainId / contract validation
 * 5. Event processing
 */
exports.handleAlchemyWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-alchemy-signature'];
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;

    // STEP 4: Raw request body preservation
    let rawBody = req.rawBody;
    if (!rawBody && Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (!rawBody && typeof req.body === 'string') {
      rawBody = req.body;
    } else if (!rawBody && req.body) {
      rawBody = JSON.stringify(req.body);
    }

    // STEP 3: Verify signature using HMAC-SHA256 & constant-time comparison
    if (!isValidAlchemySignature(rawBody || '', signature, signingKey)) {
      console.warn('[webhookController] Invalid or missing Alchemy webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }


    // Parse JSON only after signature verification
    let payload;
    try {
      payload = typeof req.body === 'object' && !Buffer.isBuffer(req.body)
        ? req.body
        : JSON.parse(rawBody);
    } catch (parseErr) {
      return res.status(400).json({ error: 'Malformed JSON payload' });
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Malformed payload: object expected' });
    }

    console.log('[webhookController] Received verified webhook:', payload.type || 'Custom Webhook');

    // Handle test / ping events from Alchemy
    if (payload.type === 'PING' || payload.type === 'TEST') {
      return res.status(200).json({ status: 'ok', message: 'Test webhook verified successfully' });
    }

    // STEP 6: Validate Chain ID if present in payload
    const payloadChainId = payload.chainId || payload.event?.chainId;
    if (payloadChainId !== undefined && payloadChainId !== null) {
      if (Number(payloadChainId) !== EXPECTED_CHAIN_ID) {
        return res.status(400).json({
          error: `Invalid chainId: ${payloadChainId}. Expected ${EXPECTED_CHAIN_ID}`,
        });
      }
    }

    // Validate network string if present
    const payloadNetwork = payload.event?.network || payload.network;
    if (payloadNetwork && typeof payloadNetwork === 'string') {
      const normNet = payloadNetwork.toUpperCase();
      if (normNet !== 'ETH_SEPOLIA' && normNet !== 'SEPOLIA' && normNet !== '11155111') {
        return res.status(400).json({
          error: `Invalid network: ${payloadNetwork}. Expected ETH_SEPOLIA / 11155111`,
        });
      }
    }

    // Extract logs
    let logs = [];
    if (Array.isArray(payload.event?.data?.block?.logs)) {
      logs = payload.event.data.block.logs;
    } else if (Array.isArray(payload.logs)) {
      logs = payload.logs;
    } else if (Array.isArray(payload.event?.logs)) {
      logs = payload.event.logs;
    } else if (Array.isArray(payload.activities)) {
      logs = payload.activities;
    } else if (payload.transactionHash && (payload.eventName || payload.eventType)) {
      logs = [payload];
    }

    let processedCount = 0;
    let duplicateCount = 0;
    let ignoredCount = 0;

    for (const log of logs) {
      const contractAddress = log.account?.address || log.address || log.contractAddress;
      if (contractAddress && !isContractAllowed(contractAddress)) {
        return res.status(400).json({
          error: `Unknown contract address: ${contractAddress}`,
        });
      }

      const txHash = log.transaction?.hash || log.transactionHash || log.hash;
      const logIndex = log.index !== undefined ? log.index : (log.logIndex !== undefined ? log.logIndex : 0);
      const eventName = log.eventName || log.eventType || log.name;
      const blockNumber = log.block?.number || log.blockNumber || payload.event?.data?.block?.number || 0;
      const blockTimestamp = log.block?.timestamp || log.timestamp || Math.floor(Date.now() / 1000);
      const args = log.args || log.decoded || log.params || {};

      if (txHash && eventName) {
        try {
          const result = await processBlockchainEvent({
            chainId: EXPECTED_CHAIN_ID,
            transactionHash: txHash,
            logIndex,
            contractAddress,
            eventName,
            blockNumber,
            blockTimestamp,
            args,
          });

          if (result.duplicate) {
            duplicateCount++;
          } else if (result.ignored) {
            ignoredCount++;
          } else {
            processedCount++;
          }
        } catch (procErr) {
          console.error('[webhookController] Error in eventProcessor:', procErr.message);
          if (procErr.message.includes('Invalid chainId') || procErr.message.includes('Rejected event from untrusted contract')) {
            return res.status(400).json({ error: procErr.message });
          }
        }
      }
    }

    // Return HTTP 200 for valid delivery (and idempotent duplicate delivery)
    return res.status(200).json({
      status: 'ok',
      processed: processedCount,
      duplicates: duplicateCount,
      ignored: ignoredCount,
    });
  } catch (err) {
    console.error('[webhookController] Webhook processing exception:', err);
    return res.status(500).json({ error: 'Internal webhook processing error' });
  }
};
