// deliverySimulator.js — Simulates the full async delivery lifecycle.
//
// PHASE 4 REWRITE: Now simulates the COMPLETE event chain instead of just
// a single success/failure outcome.
//
// REAL PROVIDER BEHAVIOR:
// When you send a WhatsApp message via Meta Cloud API, you don't get one response.
// You get a STREAM of webhook events over time:
//   1. "sent"      — our API accepted it and queued it for delivery
//   2. "delivered" — the message reached the recipient's device
//   3. "read"      — the recipient opened it (WhatsApp shows double blue ticks)
//   (optional) "clicked" — they clicked a CTA button/link
//
// Email (SendGrid/SES) works the same way — separate webhooks for:
//   delivered → opened → clicked → bounced → unsubscribed
//
// This simulator replays that async chain using staged setTimeout calls,
// where each stage has a probability of occurring.
//
// PROBABILITY CHAIN:
//   100% → 'sent'      (we always get immediate acknowledgment)
//    85% → 'delivered' (15% lost in transit — spam filters, unreachable device)
//    70% → 'opened'    (of those delivered, 70% open it)
//    40% → 'clicked'   (of those opened, 40% click a link)
//
// In production: These percentages would be replaced by real webhook events
// from Twilio/SendGrid/Meta. The CRM just needs to expose a webhook URL.
//
// In production: Each of these status callbacks would be published to a Kafka
// or SQS topic instead of direct HTTP POST, to handle scale.

const axios = require('axios');

// ─── Channel timing config ────────────────────────────────────────────────────
// Different channels have different latency profiles:
//   WhatsApp: Fast — mobile push, usually delivered in < 1s
//   SMS:      Medium — SS7 network handoff adds delay
//   Email:    Slowest — MX lookup + spam filter + SMTP relay adds seconds
const CHANNEL_TIMING = {
  whatsapp: { sentDelay: [200, 500],   deliveredDelay: [300, 800],  openedDelay: [2000, 5000],  clickedDelay: [500, 1500] },
  sms:      { sentDelay: [300, 700],   deliveredDelay: [500, 1500], openedDelay: [3000, 8000],  clickedDelay: [1000, 2000] },
  email:    { sentDelay: [500, 1200],  deliveredDelay: [1000, 3000],openedDelay: [5000, 12000], clickedDelay: [1000, 3000] },
};

// ─── Failure reasons by channel ───────────────────────────────────────────────
const FAILURE_REASONS = {
  whatsapp: ['User not on WhatsApp', 'Message delivery timeout', 'Recipient blocked messages'],
  email:    ['Invalid email address', 'Mailbox full', 'Message flagged as spam', 'Domain not found'],
  sms:      ['Number not reachable', 'DND registered', 'Invalid phone number format'],
};

// ─── Helper: random int in [min, max] ────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── Helper: pick a random failure reason ────────────────────────────────────
const pickFailureReason = (channel) => {
  const reasons = FAILURE_REASONS[channel] || ['Unknown error'];
  return reasons[Math.floor(Math.random() * reasons.length)];
};

// ─── simulateFullLifecycle ────────────────────────────────────────────────────
//
// @param {string} communicationId — the CommunicationLog _id, passed back in callbacks
// @param {string} channel         — 'whatsapp' | 'sms' | 'email'
// @param {string} message         — personalized message text (for logging only)
// @param {string} crmReceiptUrl   — full URL of the CRM receipt endpoint
//
// After each stage in the lifecycle, we POST to crmReceiptUrl with:
//   { communicationId, status, timestamp }
//
// WHY POST AFTER EACH STAGE (not just at the end)?
// Because the CRM needs real-time analytics. If 1000 messages are "sent"
// but we only call back once at the end, the marketer sees a flat "0 delivered"
// for minutes while the campaign runs. With per-event callbacks, stats update live.
//
// In production: replace axios.post() calls with kafka.publish() to a
// 'delivery-events' topic. The CRM backend subscribes and processes events
// from the queue — this decouples the services completely.
const simulateFullLifecycle = async (communicationId, channel, message, crmReceiptUrl) => {
  const timing = CHANNEL_TIMING[channel] || CHANNEL_TIMING.email;

  // ── Helper: send one status event to CRM ─────────────────────────────────
  const sendReceipt = async (status, metadata = null) => {
    try {
      await axios.post(crmReceiptUrl, {
        communicationId,
        status,
        timestamp: new Date().toISOString(),
        metadata,
      });
      console.log(`[CHANNEL-SERVICE] Receipt → CRM | id: ${communicationId} | status: ${status}`);
    } catch (err) {
      // If CRM is down, log it. In production: push to dead-letter queue.
      console.error(`[CHANNEL-SERVICE] Failed to send receipt for ${communicationId}: ${err.message}`);
      // In production this can move to a Kafka dead-letter queue for guaranteed delivery.
    }
  };

  // ── Stage 1: SENT — always happens, channel accepted the message ──────────
  await new Promise(resolve => setTimeout(resolve, rand(...timing.sentDelay)));
  await sendReceipt('sent');

  // ── Stage 2: DELIVERED — 85% probability ─────────────────────────────────
  if (Math.random() > 0.15) {
    await new Promise(resolve => setTimeout(resolve, rand(...timing.deliveredDelay)));
    await sendReceipt('delivered');

    // ── Stage 3: OPENED — 70% of delivered ───────────────────────────────
    if (Math.random() < 0.70) {
      await new Promise(resolve => setTimeout(resolve, rand(...timing.openedDelay)));
      await sendReceipt('opened');

      // ── Stage 4: CLICKED — 40% of opened ───────────────────────────────
      if (Math.random() < 0.40) {
        await new Promise(resolve => setTimeout(resolve, rand(...timing.clickedDelay)));
        await sendReceipt('clicked', 'cta_button');
      }
    }
  } else {
    // Delivery failed — this is the terminal failure state
    await new Promise(resolve => setTimeout(resolve, rand(...timing.deliveredDelay)));
    await sendReceipt('failed', pickFailureReason(channel));
  }
};

module.exports = { simulateFullLifecycle };
