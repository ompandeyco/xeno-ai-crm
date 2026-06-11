// deliverySimulator.js — Simulates message delivery over WhatsApp / Email / SMS.
//
// IN PRODUCTION this would call real third-party APIs:
//   whatsapp → Meta Cloud API (graph.facebook.com)
//   email    → SendGrid, AWS SES, or Postmark
//   sms      → Twilio, AWS SNS, or MSG91
//
// FOR THIS ASSIGNMENT: we simulate delivery using Math.random()
// with realistic success rates and delays per channel.
//
// WHY DIFFERENT SUCCESS RATES?
//   WhatsApp: ~95% — high open rate, Meta handles delivery confirmation
//   Email:    ~85% — lower due to spam filters, invalid addresses
//   SMS:      ~90% — reliable but phone numbers can be invalid or DND-registered
//
// WHY DELAYS?
//   Real delivery isn't instant. Adding delays makes the simulation realistic
//   and lets you observe the async nature of the system during a demo.

// ─── Channel configuration ────────────────────────────────────────────────────
const CHANNEL_CONFIG = {
  whatsapp: {
    successRate: 0.95,  // 95% success
    minDelayMs:  300,   // Minimum simulated latency
    maxDelayMs:  800,
  },
  email: {
    successRate: 0.85,  // 85% success
    minDelayMs:  100,   // Email servers respond faster
    maxDelayMs:  400,
  },
  sms: {
    successRate: 0.90,  // 90% success
    minDelayMs:  200,
    maxDelayMs:  600,
  },
};

// ─── Failure reasons by channel ───────────────────────────────────────────────
// Realistic failure messages that match what real APIs would return
const FAILURE_REASONS = {
  whatsapp: [
    'User not on WhatsApp',
    'Message delivery timeout',
    'Recipient blocked messages',
  ],
  email: [
    'Invalid email address',
    'Mailbox full',
    'Message flagged as spam',
    'Domain not found',
  ],
  sms: [
    'Number not reachable',
    'DND (Do Not Disturb) registered',
    'Invalid phone number format',
  ],
};

// ─── Helper: random integer between min and max ───────────────────────────────
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── simulateDelivery — Core function ─────────────────────────────────────────
//
// @param {string} channel — 'whatsapp' | 'email' | 'sms'
// @param {string} message — the personalized message to deliver
//
// @returns {Promise<{ status: 'sent' | 'failed', failureReason?: string }>}
//
// The promise resolves after a simulated delay (mimicking real API latency).
const simulateDelivery = (channel, message) => {
  return new Promise((resolve) => {
    const config = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.email;
    const delay = randomBetween(config.minDelayMs, config.maxDelayMs);

    setTimeout(() => {
      const isSuccess = Math.random() < config.successRate;

      if (isSuccess) {
        resolve({ status: 'sent' });
      } else {
        // Pick a random failure reason for the channel
        const reasons = FAILURE_REASONS[channel] || ['Unknown error'];
        const failureReason = reasons[Math.floor(Math.random() * reasons.length)];
        resolve({ status: 'failed', failureReason });
      }
    }, delay);
  });
};

module.exports = { simulateDelivery };
