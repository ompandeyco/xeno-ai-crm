// app.js — Express application factory.
//
// IMPORTANT DESIGN DECISION:
// app.js creates and configures the Express app but does NOT start the server.
// The actual server.listen() call lives in server.js.
//
// WHY? This separation means:
// 1. Tests can import app without starting a real server
// 2. server.js handles the DB connection BEFORE the server opens for traffic
// 3. Cleaner separation of concerns

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// ─── Route Imports ───────────────────────────────────────────────────────────
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const campaignRoutes = require('./routes/campaignRoutes');

// ─── Middleware Imports ───────────────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Core Middleware ─────────────────────────────────────────────────────────
app.use(cors());            // Allow cross-origin requests from the React frontend
app.use(morgan('dev'));     // Log every request: method, path, status, response time
app.use(express.json());    // Parse JSON request bodies — req.body will be populated

// ─── Root Route ───────────────────────────────────────────────────────────────
// Returned when someone opens the base URL — confirms the service is alive.
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Xeno AI CRM Backend Running',
    version: '1.0.0',
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
// Detailed ping endpoint — useful for Docker healthchecks, uptime monitors, etc.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'crm-backend',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// All customer endpoints: /api/customers, /api/customers/:id
app.use('/api/customers', customerRoutes);

// All order endpoints: /api/orders, /api/orders/customer/:customerId
app.use('/api/orders', orderRoutes);

// All campaign endpoints: /api/campaigns, /api/campaigns/:id/send, /api/campaigns/receipt
app.use('/api/campaigns', campaignRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
// This runs if no route above matched the request
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// MUST be registered LAST — Express identifies error handlers by their 4 parameters
app.use(errorHandler);

module.exports = app;
