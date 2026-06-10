// Order.js — Mongoose schema for a customer's purchase.
//
// RELATIONSHIP DECISION:
// Order references Customer via ObjectId (a foreign key equivalent in MongoDB).
// We do NOT embed orders inside the customer document because:
//   1. A customer can have hundreds of orders — the document would grow unboundedly
//   2. MongoDB has a 16MB document size limit
//   3. We need to query orders independently (e.g. orders by date range, by category)
//
// So Customer ←──── Order is a "reference" relationship (like a relational JOIN).
// To get a customer's orders: query Order.find({ customerId: <id> })

const mongoose = require('mongoose');

// ─── Sub-schema: Order Line Item ──────────────────────────────────────────────
// Each order can have multiple products. We embed items because:
// - Items are NEVER queried independently — they're always fetched with their order
// - Embedding keeps a complete order snapshot (price at time of purchase)
const orderItemSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
  },
  { _id: false } // No separate _id for each line item
);

// ─── Main Order Schema ────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    // ref: 'Customer' tells Mongoose which model to use when .populate() is called
    // This is MongoDB's equivalent of a foreign key — but NOT enforced at DB level,
    // only at the application level by Mongoose.
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
    },

    // An array of embedded line items
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'Order must have at least one item',
      },
    },

    // totalAmount is intentionally stored (denormalized) so we don't have to
    // sum items.price * items.quantity every time we display order history.
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total cannot be negative'],
    },

    orderDate: {
      type: Date,
      default: Date.now, // Defaults to the time the document is created
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Most common query pattern: "Give me all orders for customer X"
// This index makes that query O(log n) instead of a full collection scan.
orderSchema.index({ customerId: 1, orderDate: -1 });

module.exports = mongoose.model('Order', orderSchema);
