// orderService.js — Business logic for orders.
//
// THE KEY OPERATION HERE:
// When an order is created, we must atomically update the customer's purchaseSummary:
//   - Increment totalOrders by 1
//   - Increment totalSpend by the order's totalAmount
//   - Set lastPurchaseDate to today (if this is the most recent order)
//
// We use MongoDB's $inc and $set operators inside findByIdAndUpdate.
// This is ATOMIC — no risk of a partial update if the server crashes mid-operation.

const Order = require('../models/Order');
const Customer = require('../models/Customer');

// ─── Create an order and update customer summary ───────────────────────────────
const createOrder = async (orderData) => {
  // Step 1: Validate that the customer exists before creating the order
  const customer = await Customer.findById(orderData.customerId);
  if (!customer) {
    const error = new Error('Customer not found — cannot create order');
    error.statusCode = 404;
    throw error;
  }

  // Step 2: Calculate totalAmount from items (don't trust client-sent totals)
  // price * quantity for each item, summed up
  const calculatedTotal = orderData.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  // Step 3: Create the order document
  const order = await Order.create({
    ...orderData,
    totalAmount: calculatedTotal, // Override with server-calculated total
  });

  // Step 4: Update the customer's purchaseSummary ATOMICALLY
  // $inc: increment numeric fields
  // $set: set a field to a new value
  // { new: true } returns the updated document (not the original)
  await Customer.findByIdAndUpdate(
    orderData.customerId,
    {
      $inc: {
        'purchaseSummary.totalOrders': 1,
        'purchaseSummary.totalSpend': calculatedTotal,
      },
      $set: {
        'purchaseSummary.lastPurchaseDate': order.orderDate,
      },
    },
    { new: true }
  );

  return order;
};

// ─── Get all orders for a specific customer ────────────────────────────────────
// Returns orders sorted newest first — most useful for a purchase history view.
const getOrdersByCustomer = async (customerId) => {
  // Validate customer exists first
  const customerExists = await Customer.exists({ _id: customerId });
  if (!customerExists) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  const orders = await Order.find({ customerId })
    .sort({ orderDate: -1 }) // Most recent first
    .select('-__v');

  return orders;
};

module.exports = {
  createOrder,
  getOrdersByCustomer,
};
