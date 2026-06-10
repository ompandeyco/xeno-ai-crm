// customerRoutes.js
// Responsibility: Map HTTP verbs + URL paths to controller functions.
// Routes are the "traffic cops" — they receive the request and hand it to the right controller.

const express = require('express');
const router = express.Router();

// Controllers will be imported here once implemented
// const { getCustomers, createCustomer } = require('../controllers/customerController');

// router.get('/', getCustomers);
// router.post('/', createCustomer);

module.exports = router;
