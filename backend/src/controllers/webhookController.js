const crypto = require('crypto');
const { processBlockchainEvent } = require('../listeners/blockchainListener');

/**
 * Validates HMAC SHA-256 signature from Alchemy Webhooks
 */
function isValidAlchemySignature(rawBody, signature, signingKey) {
  if (!signingKey) {
    console.warn('[webhookController] ALCHEMY_WEBHOOK_SIGNING_KEY not set; skipping signature check in dev mode');
    return true;
  }
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', signingKey);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  return digest === signature;
}

exports.handleAlchemyWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-alchemy-signature'];
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;

    // Use rawBody buffer or stringified body
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!isValidAlchemySignature(rawBody, signature, signingKey)) {
      console.warn('[webhookController] Invalid Alchemy webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = req.body;
    console.log('[webhookController] Received verified webhook:', payload.type || 'Custom Webhook');

    // Handle test/ping requests from Alchemy
    if (payload.type === 'TEST' || payload.type === 'PING') {
      return res.status(200).json({ status: 'ok', message: 'Test webhook verified successfully' });
    }

    // Parse logs from Alchemy Custom Webhooks or GraphQL Webhooks
    const logs = payload.event?.data?.block?.logs || payload.logs || payload.activities || [];
    let processedCount = 0;

    for (const log of logs) {
      try {
        const txHash = log.transaction?.hash || log.transactionHash || log.hash;
        const logIndex = log.index !== undefined ? log.index : (log.logIndex || 0);
        const eventType = log.eventName || log.eventType || log.topics?.[0];
        const blockNumber = log.block?.number || log.blockNumber || 0;
        const args = log.args || log.decoded || {};

        if (txHash && eventType) {
          await processBlockchainEvent({
            chainId: Number(process.env.CHAIN_ID || 11155111),
            transactionHash: txHash,
            logIndex,
            eventType,
            blockNumber,
            args,
          });
          processedCount++;
        }
      } catch (logErr) {
        console.error('[webhookController] Error processing single log:', logErr);
      }
    }

    res.status(200).json({
      status: 'ok',
      processed: processedCount,
    });
  } catch (err) {
    console.error('[webhookController] Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
