// receiptController.js — Handles delivery status callbacks from channel-service.
//
// PHASE 4: This is a NEW dedicated controller for receipt handling.
// Previously, receipts were processed in campaignController.
// We separate them because:
//   1. Receipts are called by a MACHINE (channel-service), not a human
//   2. They have different validation needs and SLA requirements
//   3. In production, receipts would come from a Kafka consumer, not HTTP directly
//   4. Separating them makes it trivial to add auth (shared secret / HMAC)
//      between channel-service and CRM backend
//
// WHAT THIS ENDPOINT DOES:
// The channel-service calls POST /api/receipts/channel for EACH status event:
//   { communicationId, status, timestamp, metadata? }
//
// We:
//   1. Find the CommunicationLog by communicationId
//   2. Update currentStatus (fast reads)
//   3. Push the event into statusHistory (append-only audit log)
//   4. Increment the appropriate stat counter on the Campaign
//
// IDEMPOTENCY:
// The same event might be delivered twice (network retries).
// We check if the status is already in statusHistory before pushing — no-op if duplicate.

const asyncHandler = require('../utils/asyncHandler');
const CommunicationLog = require('../models/CommunicationLog');
const Campaign = require('../models/Campaign');

// ─── POST /api/receipts/channel ───────────────────────────────────────────────
// Called by channel-service after each status event in the delivery lifecycle.
//
// Body: { communicationId, status, timestamp, metadata? }
//
// Valid statuses: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'
const handleChannelReceipt = asyncHandler(async (req, res) => {
  const { communicationId, status, timestamp, metadata } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  const VALID_STATUSES = ['sent', 'delivered', 'opened', 'clicked', 'failed'];

  if (!communicationId || !status) {
    return res.status(400).json({
      success: false,
      message: 'communicationId and status are required',
    });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status: ${status}. Valid: ${VALID_STATUSES.join(', ')}`,
    });
  }

  // ── Find the log ──────────────────────────────────────────────────────────
  const log = await CommunicationLog.findById(communicationId);

  if (!log) {
    // Return 200 (not 404) so channel-service doesn't retry endlessly.
    // The log might have been deleted — this is a safe no-op.
    console.warn(`[RECEIPT] CommunicationLog ${communicationId} not found — ignoring`);
    return res.status(200).json({ success: true, message: 'Log not found — no-op' });
  }

  // ── Idempotency check — prevent duplicate event processing ───────────────
  // If the same status already exists in the history, skip it.
  // This handles the case where channel-service retries a failed HTTP call.
  const alreadyProcessed = log.statusHistory.some(event => event.status === status);
  if (alreadyProcessed) {
    console.log(`[RECEIPT] Duplicate event ignored | id: ${communicationId} | status: ${status}`);
    return res.status(200).json({ success: true, message: 'Duplicate event — no-op' });
  }

  // ── Update CommunicationLog ───────────────────────────────────────────────
  // $push statusHistory: append the new event (never modify existing entries)
  // $set currentStatus: update the denormalized "latest status" field
  await CommunicationLog.findByIdAndUpdate(
    communicationId,
    {
      $set:  { currentStatus: status },
      $push: {
        statusHistory: {
          status,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          metadata:  metadata || null,
        },
      },
      // Store failure reason on the top-level document for easy querying
      ...(status === 'failed' && { $set: { currentStatus: status, failureReason: metadata || 'Unknown' } }),
    }
  );

  // ── Update Campaign stats ─────────────────────────────────────────────────
  // Map each status event to the corresponding campaign stat counter.
  // 'sent' is NOT counted here — it's counted at dispatch time in campaignService.
  // All other events increment their own counter.
  const STAT_MAP = {
    delivered: 'stats.delivered',
    opened:    'stats.opened',
    clicked:   'stats.clicked',
    failed:    'stats.failed',
  };

  const statField = STAT_MAP[status];
  if (statField) {
    await Campaign.findByIdAndUpdate(log.campaignId, {
      $inc: { [statField]: 1 },
    });
  }

  // ── Respond 200 to channel-service ───────────────────────────────────────
  // Respond quickly so the channel-service can continue processing other events.
  res.status(200).json({
    success: true,
    message: `Status '${status}' recorded for communication ${communicationId}`,
  });
});

module.exports = { handleChannelReceipt };
