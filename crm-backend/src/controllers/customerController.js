// customerController.js — HTTP layer for customer endpoints.
//
// CONTROLLER RESPONSIBILITY:
// 1. Read data from req (params, body, query)
// 2. Call the appropriate service function
// 3. Send the HTTP response
//
// Controllers contain ZERO business logic and ZERO database calls.
// All of that lives in customerService.js.

const asyncHandler = require('../utils/asyncHandler');
const customerService = require('../services/customerService');

// ─── POST /api/customers ───────────────────────────────────────────────────────
// Wrapped in asyncHandler so any thrown error is automatically forwarded to errorHandler
const createCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body);

  // 201 Created is the correct status for a successful resource creation
  res.status(201).json({
    success: true,
    message: 'Customer created successfully',
    data: customer,
  });
});

// ─── GET /api/customers ────────────────────────────────────────────────────────
// Supports ?page=2&limit=50 query params for pagination
const getAllCustomers = asyncHandler(async (req, res) => {
  // parseInt with fallback — req.query values are always strings
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const result = await customerService.getAllCustomers(page, limit);

  res.status(200).json({
    success: true,
    data: result.customers,
    pagination: result.pagination,
  });
});

// ─── GET /api/customers/:id ────────────────────────────────────────────────────
const getCustomerById = asyncHandler(async (req, res) => {
  // req.params.id comes from the :id placeholder in the route definition
  const customer = await customerService.getCustomerById(req.params.id);

  res.status(200).json({
    success: true,
    data: customer,
  });
});

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
};
