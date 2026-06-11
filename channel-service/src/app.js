// app.js — Entry point for the Channel Service.
//
// This microservice has ONE job:
// 1. Receive a "send message" POST from the CRM Backend
// 2. Simulate delivery via deliverySimulator (WhatsApp / Email / SMS)
// 3. POST the delivery receipt back to CRM Backend asynchronously
//
// It has NO database — it is stateless.
// All state (CommunicationLog) is stored in the CRM Backend's MongoDB.

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const messageRoutes = require('./routes/messageRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Core Middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ─── Root Route ──────────────────────────────────────────────────────────────
// Returns immediately when someone opens the base URL — confirms service is alive.
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Xeno Channel Service Running',
    version: '1.0.0',
  });
});

// ─── Health Check ────────────────────────────────────────────────────────────
// Detailed ping for Docker healthchecks / uptime monitors.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'channel-service',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// Routes are mounted at root '/' so the full path is: POST /channel/send
// This matches the spec exactly.
app.use('/', messageRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`[CHANNEL-SERVICE] Running on http://localhost:${PORT}`);
});
