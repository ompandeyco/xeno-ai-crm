// CommunicationLog.js — One record per message attempt.
//
// WHY A SEPARATE COLLECTION?
// When a campaign runs, we send one message per customer in the audience.
// We need to track each individual delivery attempt independently because:
//   - Customer A's message might FAIL while Customer B's SUCCEEDS
//   - We need per-customer delivery receipts from the channel service
//   - Campaign stats (sent/delivered/failed) are computed by aggregating these logs
//
// RELATIONSHIP:
//   CommunicationLog → Campaign (1 campaign : N logs)
//   CommunicationLog → Customer (1 customer : N logs, one per campaign they're in)
//
// STATUS FLOW:
//   'pending'  → created when the dispatch loop sends the message
//   'sent'     → channel service confirmed delivery
//   'failed'   → channel service reported failure

const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema(
  {
    // Which campaign this log belongs to
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true, // We'll query "all logs for campaign X" frequently
    },

    // Which customer received (or should receive) this message
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },

    // The personalized message that was sent (after substituting {name})
    message: {
      type: String,
      required: true,
    },

    // Which channel was used
    channel: {
      type: String,
      enum: ['email', 'whatsapp', 'sms'],
      required: true,
    },

    // Delivery status — updated via the callback from channel-service
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },

    // Timestamp when the channel service sent us the delivery receipt
    deliveredAt: {
      type: Date,
      default: null,
    },

    // Optional reason string if status is 'failed'
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = when we dispatched, updatedAt = when status changed
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Compound index: fast lookup of "all logs for campaign X"
// Also used when computing campaign stats (count by campaignId + status)
communicationLogSchema.index({ campaignId: 1, status: 1 });

module.exports = mongoose.model('CommunicationLog', communicationLogSchema);
