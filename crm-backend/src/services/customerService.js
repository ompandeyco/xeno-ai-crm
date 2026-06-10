// customerService.js — All business logic for customers.
//
// LAYER RESPONSIBILITY:
// - Controller layer: reads req, calls service, writes res
// - Service layer (THIS FILE): all logic, DB operations, transformations
// - Model layer: schema definition only
//
// Controllers never import Customer model directly.
// If we swap MongoDB for another DB, only services change — controllers stay untouched.

const Customer = require('../models/Customer');

// ─── Create a new customer ─────────────────────────────────────────────────────
// Mongoose's Model.create() validates the data against the schema before inserting.
// If email is duplicate, MongoDB throws code 11000 (unique index violation).
const createCustomer = async (customerData) => {
  const customer = await Customer.create(customerData);
  return customer;
};

// ─── Get all customers with optional pagination ────────────────────────────────
// We add pagination immediately — fetching ALL customers is never acceptable in production.
// Default: page 1, 20 customers per page.
const getAllCustomers = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit; // e.g. page 3, limit 20 → skip 40

  // Run count and find in PARALLEL using Promise.all for better performance
  const [customers, total] = await Promise.all([
    Customer.find()
      .sort({ createdAt: -1 }) // Newest customers first
      .skip(skip)
      .limit(limit)
      .select('-__v'), // Exclude Mongoose's internal version field
    Customer.countDocuments(),
  ]);

  return {
    customers,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCustomers: total,
      hasNextPage: page < Math.ceil(total / limit),
    },
  };
};

// ─── Get a single customer by their MongoDB _id ────────────────────────────────
const getCustomerById = async (customerId) => {
  // findById is a shorthand for findOne({ _id: customerId })
  const customer = await Customer.findById(customerId).select('-__v');

  if (!customer) {
    // Throwing an error here lets asyncHandler catch it and pass it to errorHandler
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  return customer;
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
};
