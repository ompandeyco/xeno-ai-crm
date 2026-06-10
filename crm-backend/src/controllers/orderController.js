// orderController.js — HTTP layer for order endpoints.
//
// Same pattern as customerController — thin, no logic, just req → service → res.

const asyncHandler = require('../utils/asyncHandler');
const orderService = require('../services/orderService');

// ─── POST /api/orders ─────────────────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body);

  res.status(201).json({
    success: true,
    message: 'Order created and customer summary updated',
    data: order,
  });
});

// ─── GET /api/orders/customer/:customerId ──────────────────────────────────────
// Fetch full purchase history for a specific customer
const getOrdersByCustomer = asyncHandler(async (req, res) => {
  const orders = await orderService.getOrdersByCustomer(req.params.customerId);

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

module.exports = {
  createOrder,
  getOrdersByCustomer,
};
