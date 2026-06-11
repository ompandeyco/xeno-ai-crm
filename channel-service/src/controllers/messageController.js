// messageController.js — Receives dispatch requests from the CRM backend.
//
// PHASE 4 CHANGES:
//   - Endpoint is now POST /channel/send (matches spec)
//   - Accepts full customer object { name, email, phone }
//   - Uses communicationId (not logId) to match the updated CommunicationLog
//   - Invokes simulateFullLifecycle which sends multiple status callbacks
//   - Retry logic is handled in campaignService on the CRM side (see there)
//
// FLOW:
// 1. CRM Backend POSTs to POST /channel/send with:
//    { communicationId, customer: { name, email, phone }, channel, message }
//
// 2. This controller immediately responds 202 Accepted
//    WHY 202 and not 200?
//    HTTP 200 means "done". HTTP 202 means "I accepted the task, processing async."
//    202 is semantically correct here — delivery hasn't happened yet.
//
// 3. AFTER the response, simulateFullLifecycle runs in the background.
//    It fires multiple POSTs back to the CRM receipt endpoint:
//      sent → delivered → opened → clicked  (or → failed)
//
// In production: step 3 would be replaced by publishing a message to a
// Kafka topic ("messages-to-send"), and a separate worker service would
// consume from that topic. This controller would just enqueue the job.

const { simulateFullLifecycle } = require('../services/deliverySimulator');

// ─── POST /channel/send ───────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  const { communicationId, customer, channel, message } = req.body;

  // Validate required fields
  if (!communicationId || !channel || !message || !customer) {
    return res.status(400).json({
      success: false,
      message: 'communicationId, customer, channel, and message are required',
    });
  }

  // ── Respond IMMEDIATELY — do not block waiting for delivery ──────────────
  // The CRM backend's dispatch loop is waiting for this 202.
  // Returning quickly lets the dispatch loop move on to the next customer.
  res.status(202).json({
    success: true,
    status: 'accepted',
    communicationId,
  });

  // ── Simulate full delivery lifecycle AFTER response ───────────────────────
  // Node.js event loop: the response is sent, then the async function below
  // continues running in the background without blocking any other requests.
  //
  // The CRM receipt URL — channel-service calls back here after each status event.
  const crmUrl = process.env.CRM_BACKEND_URL || 'http://localhost:5001';
  const crmReceiptUrl = `${crmUrl}/api/receipts/channel`;

  // Fire and forget — errors are handled inside simulateFullLifecycle
  simulateFullLifecycle(communicationId, channel, message, crmReceiptUrl).catch((err) => {
    console.error(`[CHANNEL-SERVICE] Lifecycle simulation error for ${communicationId}: ${err.message}`);
    // In production this can move to a Kafka dead-letter queue or retry queue
  });
};

module.exports = { sendMessage };
