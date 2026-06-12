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
const orderRoutes    = require('./routes/orderRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const receiptRoutes  = require('./routes/receiptRoutes'); // PHASE 4: machine-to-machine callbacks from channel-service
const aiRoutes       = require('./routes/aiRoutes');       // PHASE 5: AI Marketing Agent

// ─── Middleware Imports ───────────────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Core Middleware ─────────────────────────────────────────────────────────
// CORS — MUST be the very first middleware so every response (including errors
// and preflight OPTIONS) carries the correct Access-Control-Allow-Origin header.
const ALLOWED_ORIGINS = [
  'https://xeno-ai-crm.vercel.app', // Production frontend (Vercel)
  'http://localhost:5173',           // Vite dev server
  'http://localhost:3000',           // CRA / other local tooling
  'http://127.0.0.1:5173',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server requests (no Origin header) and whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));          // Apply CORS to all routes
app.options('*', cors(corsOptions)); // Explicitly handle all preflight OPTIONS requests

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

// All campaign endpoints: /api/campaigns, /api/campaigns/:id/send, etc.
app.use('/api/campaigns', campaignRoutes);

// PHASE 4: Receipt endpoint — machine-to-machine callback from channel-service
// POST /api/receipts/channel — channel-service calls this after each delivery event
app.use('/api/receipts', receiptRoutes);

// PHASE 5: AI Marketing Agent
// POST /api/ai/segment    — natural language → customer segment rules
// POST /api/ai/message    — goal + segment + channel → personalized message template
// GET  /api/ai/insights/:campaignId — campaign stats → AI analysis + recommendations
app.use('/api/ai', aiRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
// This runs if no route above matched the request
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// MUST be registered LAST — Express identifies error handlers by their 4 parameters
app.use(errorHandler);

module.exports = app;
