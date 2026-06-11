// CommunicationLog.js — One record per message attempt per customer per campaign.
//
// UPGRADED IN PHASE 4:
// Added full delivery lifecycle tracking:
//   statusHistory[] — append-only log of every status event received from channel-service
//   currentStatus   — the latest status (denormalized for fast reads)
//   retryCount      — how many times we re-tried the channel-service call
//
// STATUS LIFECYCLE:
//
//   Successful flow:
//     pending → sent → delivered → opened → clicked
//
//   Failure flow:
//     pending → sent → failed
//
//   If channel-service is unreachable at dispatch time:
//     pending → failed  (immediately, no channel involvement)
//
// WHY statusHistory INSTEAD OF JUST status?
//   A single 'status' field only tells you the CURRENT state.
//   statusHistory lets you answer questions like:
//     "How long between sent and delivered?" (latency)
//     "What % of delivered messages got opened?" (engagement funnel)
//   These are the analytics that make a CRM valuable.
//
// WHY retryCount?
//   Network calls to channel-service can fail transiently.
//   We retry up to MAX_RETRIES times before giving up.
//   Storing retryCount lets us audit "how healthy was the channel-service
//   during this campaign?" and alert if retries are spiking.

const mongoose = require('mongoose');

// ─── Sub-schema: A single status event ───────────────────────────────────────
// Every time the channel-service sends us a status update, we push one of these.
// This is an APPEND-ONLY log — we never modify existing entries.
const statusEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'opened', 'clicked', 'failed'],
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Optional metadata — e.g. failure reason, or which link was clicked
    metadata: {
      type: String,
      default: null,
    },
  },
  { _id: false } // No separate _id for sub-documents in the history array
);

// ─── Main CommunicationLog Schema ─────────────────────────────────────────────
const communicationLogSchema = new mongoose.Schema(
  {
    // Which campaign this log belongs to
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true, // Heavy query: "all logs for campaign X"
    },

    // Which customer this message was sent to
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },

    // The personalized message (after replacing {name} placeholder)
    message: {
      type: String,
      required: true,
    },

    // Which channel was used for this message
    channel: {
      type: String,
      enum: ['email', 'whatsapp', 'sms'],
      required: true,
    },

    // ── PHASE 4 ADDITIONS ────────────────────────────────────────────────────

    // currentStatus: the LATEST status — denormalized for fast queries.
    // e.g. "how many messages are currently in 'delivered' state?"
    // Without this, we'd have to scan the statusHistory array for every document.
    currentStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'opened', 'clicked', 'failed'],
      default: 'pending',
    },

    // statusHistory: full append-only event log.
    // e.g. [
    //   { status: 'sent',      timestamp: T+0.3s },
    //   { status: 'delivered', timestamp: T+1.2s },
    //   { status: 'opened',    timestamp: T+4.5s },
    //   { status: 'clicked',   timestamp: T+5.1s }
    // ]
    statusHistory: {
      type: [statusEventSchema],
      default: [],
    },

    // How many times we retried the channel-service HTTP call.
    // 0 = succeeded on first attempt.
    // In production this would trigger an alert if consistently > 0.
    retryCount: {
      type: Number,
      default: 0,
    },

    // Optional: reason stored when currentStatus === 'failed'
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = dispatch time, updatedAt = last status change
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// 1. Fast lookup by campaignId + currentStatus — used for stats aggregation
//    "How many 'delivered' logs are there for campaign X?"
communicationLogSchema.index({ campaignId: 1, currentStatus: 1 });

// 2. Used by the receipt handler: "find log by campaignId + customerId"
//    (to detect duplicate callbacks)
communicationLogSchema.index({ campaignId: 1, customerId: 1 });

module.exports = mongoose.model('CommunicationLog', communicationLogSchema);
