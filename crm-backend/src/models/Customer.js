// Customer.js — Mongoose schema for a consumer brand shopper.
//
// DESIGN PRINCIPLE: This is a CONSUMER CRM, NOT a sales CRM.
// There are NO leads, deals, pipelines, or tickets here.
// A Customer = a real person who has bought (or might buy) from a brand.
//
// SCHEMA STRATEGY: We embed three sub-documents instead of separate collections:
//   - attributes     → demographic data (age, gender, city)
//   - purchaseSummary → aggregated stats updated on every order
//   - engagement     → channel preferences and open rates
//
// WHY EMBED? These fields are almost always read together with the customer.
// Embedding avoids expensive $lookup (JOIN) operations at query time.

const mongoose = require('mongoose');

// ─── Sub-schema: Demographic Attributes ──────────────────────────────────────
const attributesSchema = new mongoose.Schema(
  {
    age: {
      type: Number,
      min: 1,
      max: 120,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    city: {
      type: String,
      trim: true,
    },
  },
  { _id: false } // _id: false → no separate _id field for this embedded doc
);

// ─── Sub-schema: Purchase Summary ─────────────────────────────────────────────
// These are DENORMALIZED aggregates — they are redundant (can be computed from Orders)
// but stored here for FAST reads without running aggregation every time.
// The tradeoff: we must keep them in sync on every order write. See orderService.js.
const purchaseSummarySchema = new mongoose.Schema(
  {
    totalSpend: {
      type: Number,
      default: 0, // Starts at 0, incremented on each order
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    lastPurchaseDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// ─── Sub-schema: Engagement Preferences ──────────────────────────────────────
// This is used by the AI/campaign engine to decide which channel to use.
// Open rates help the system prefer the channel the customer actually responds to.
const engagementSchema = new mongoose.Schema(
  {
    preferredChannel: {
      type: String,
      enum: ['email', 'whatsapp', 'sms'],
      default: 'email',
    },
    emailOpenRate: {
      type: Number,
      min: 0,
      max: 1,  // Stored as a decimal: 0.45 = 45% open rate
      default: 0,
    },
    whatsappOpenRate: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
  },
  { _id: false }
);

// ─── Main Customer Schema ─────────────────────────────────────────────────────
const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,        // Prevents duplicate customer records
      lowercase: true,     // Normalizes to lowercase before saving
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      trim: true,
    },

    // Embedded sub-documents — always loaded with the parent document
    attributes: {
      type: attributesSchema,
      default: () => ({}),
    },
    purchaseSummary: {
      type: purchaseSummarySchema,
      default: () => ({}),
    },
    engagement: {
      type: engagementSchema,
      default: () => ({}),
    },
  },
  {
    // timestamps: true automatically adds createdAt and updatedAt fields
    // Mongoose manages these — we never set them manually
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// email is already indexed because of unique: true above.
// We add a compound index for segmentation queries like:
// "Find customers in Mumbai who spent more than ₹5000"
customerSchema.index({ 'attributes.city': 1, 'purchaseSummary.totalSpend': -1 });

// ─── Export ───────────────────────────────────────────────────────────────────
// mongoose.model() compiles the schema into a Model class.
// The collection name in MongoDB will be 'customers' (auto-pluralized).
module.exports = mongoose.model('Customer', customerSchema);
