// orderRoutes.js — Maps HTTP verbs + paths to order controller functions.
//
// Base path /api/orders is registered in app.js.

const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrdersByCustomer,
} = require('../controllers/orderController');

// POST   /api/orders                          → create a new order
router.route('/')
  .post(createOrder);

// GET    /api/orders/customer/:customerId      → get purchase history for one customer
// NOTE: This route uses a nested path pattern (/customer/:customerId).
// It must be defined BEFORE any /:id routes to avoid Express confusing
// "customer" as a literal :id value.
router.route('/customer/:customerId')
  .get(getOrdersByCustomer);

module.exports = router;
