// messageController.js — Receives dispatch requests from the CRM backend.
//
// FLOW:
// 1. CRM Backend POSTs to POST /api/messages/send with:
//    { logId, customerId, channel, message }
//
// 2. This controller calls deliverySimulator to simulate actual delivery
//
// 3. After delivery (success or failure), it POSTs back to CRM Backend at
//    POST /api/campaigns/receipt with:
//    { logId, status: 'sent' | 'failed', failureReason? }
//
// WHY ASYNC CALLBACK INSTEAD OF RETURNING THE RESULT?
// Because real delivery is async — you send an SMS and Twilio tells you
// hours later if it was delivered. This pattern mimics that reality.
// The CRM Backend doesn't block waiting for delivery — it just dispatches
// and the receipt comes back whenever it's ready.

const axios = require('axios');
const { simulateDelivery } = require('../services/deliverySimulator');

// ─── POST /api/messages/send ──────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  const { logId, customerId, channel, message } = req.body;

  // Validate required fields
  if (!logId || !channel || !message) {
    return res.status(400).json({
      success: false,
      message: 'logId, channel, and message are required',
    });
  }

  // ── Respond immediately to CRM Backend ────────────────────────────────────
  // We send 202 Accepted RIGHT NOW — the channel-service has ACCEPTED the job.
  // The actual delivery happens asynchronously AFTER this response.
  //
  // WHY 202 and not 200?
  // HTTP 202 = "I received your request and will process it, but I'm not done yet."
  // This is semantically correct for async jobs.
  res.status(202).json({
    success: true,
    message: 'Message accepted for delivery',
    logId,
  });

  // ── Simulate delivery asynchronously ──────────────────────────────────────
  // This runs AFTER the response is already sent to the CRM Backend.
  // Node.js event loop handles this naturally.
  try {
    const result = await simulateDelivery(channel, message);

    // ── Callback: POST delivery receipt to CRM Backend ────────────────────
    const crmUrl = process.env.CRM_BACKEND_URL || 'http://localhost:5001';

    await axios.post(`${crmUrl}/api/campaigns/receipt`, {
      logId,
      status: result.status,
      failureReason: result.failureReason || null,
    });

    console.log(`[CHANNEL-SERVICE] Receipt sent | logId: ${logId} | status: ${result.status}`);
  } catch (err) {
    // If the callback to CRM fails, log it — the log will remain 'pending'
    // In production, this would be retried via a message queue (SQS, RabbitMQ).
    console.error(`[CHANNEL-SERVICE] Failed to send receipt for logId ${logId}: ${err.message}`);
  }
};

module.exports = { sendMessage };
