// Campaign.js — Mongoose schema for a marketing campaign.
//
// WHAT IS A CAMPAIGN?
// A campaign = a marketer's intent to reach a specific slice of customers
// with a specific message over a specific channel.
//
// LIFECYCLE:
//   draft → sending → completed
//   The status advances as the system dispatches messages.
//
// SEGMENT RULES DESIGN:
// Instead of hardcoding filter logic in the schema, we store rules as a
// flexible JSON array. Each rule has: { field, operator, value }.
// Examples:
//   { field: 'purchaseSummary.totalSpend', operator: 'gt', value: 5000 }
//   { field: 'attributes.city', operator: 'eq', value: 'Mumbai' }
//
// WHY? This lets the AI (or the UI) generate segment rules dynamically
// without changing the schema. The campaignService reads these rules
// and translates them into a MongoDB query at runtime.
//
// STATS:
// audienceSize   → how many customers matched the segment
// sent           → how many messages were dispatched
// delivered      → how many confirmed SENT by channel service
// failed         → how many bounced / FAILED

const mongoose = require('mongoose');

// ─── Sub-schema: A single segment rule ───────────────────────────────────────
const segmentRuleSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      // e.g. 'purchaseSummary.totalSpend', 'attributes.city', 'attributes.age'
    },
    operator: {
      type: String,
      required: true,
      enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'],
      // gt = greater than, gte = >=, lt = less than, lte = <=, eq = equals, ne = not equals
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      // Mixed = can be a number, string, or boolean — depends on the field
    },
  },
  { _id: false }
);

// ─── Sub-schema: Campaign Stats ───────────────────────────────────────────────
// PHASE 4: Added 'opened' and 'clicked' to track the full engagement funnel:
//   audienceSize → sent → delivered → opened → clicked
//   Each metric narrows: not everyone who receives opens, not everyone who opens clicks.
//   This funnel is the core analytics output of the CRM.
const campaignStatsSchema = new mongoose.Schema(
  {
    audienceSize: { type: Number, default: 0 },
    sent:         { type: Number, default: 0 }, // Channel-service accepted the message
    delivered:    { type: Number, default: 0 }, // Confirmed delivery to device
    opened:       { type: Number, default: 0 }, // Customer opened the message
    clicked:      { type: Number, default: 0 }, // Customer clicked a link inside
    failed:       { type: Number, default: 0 }, // Delivery failed permanently
  },
  { _id: false }
);

// ─── Main Campaign Schema ─────────────────────────────────────────────────────
const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },

    // The natural-language goal entered by the marketer.
    // e.g. "Re-engage users who haven't bought in 90 days"
    // This is stored as context — useful for the AI to generate message + rules.
    goal: {
      type: String,
      trim: true,
    },

    // Array of filter rules — resolved into a MongoDB query by campaignService.
    // Empty array = target ALL customers (broadcast).
    segmentRules: {
      type: [segmentRuleSchema],
      default: [],
    },

    // The message template to send.
    // Can contain a {name} placeholder that gets personalized per customer.
    message: {
      type: String,
      required: [true, 'Campaign message is required'],
      trim: true,
    },

    // Which channel to use for this campaign
    channel: {
      type: String,
      required: true,
      enum: ['email', 'whatsapp', 'sms'],
      default: 'email',
    },

    // Campaign lifecycle status
    status: {
      type: String,
      enum: ['draft', 'sending', 'completed'],
      default: 'draft',
    },

    // Populated when the campaign is dispatched
    stats: {
      type: campaignStatsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true, // createdAt = when campaign was created, updatedAt = last modified
  }
);

// ─── Index ────────────────────────────────────────────────────────────────────
// Most common query: "show me all campaigns sorted by newest"
campaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Campaign', campaignSchema);
