// customerRoutes.js — Maps HTTP verbs + paths to controller functions.
//
// Routes should be SHORT — just the verb, path, and controller reference.
// All logic is in the controller + service layer below.
//
// Base path /api/customers is registered in app.js.
// So here we only define the RELATIVE path from that base.

const express = require('express');
const router = express.Router();
const {
  createCustomer,
  getAllCustomers,
  getCustomerById,
} = require('../controllers/customerController');

// POST   /api/customers       → create a new customer
// GET    /api/customers       → list all customers (paginated)
router.route('/')
  .post(createCustomer)
  .get(getAllCustomers);

// GET    /api/customers/:id   → get a single customer by ID
router.route('/:id')
  .get(getCustomerById);

module.exports = router;
