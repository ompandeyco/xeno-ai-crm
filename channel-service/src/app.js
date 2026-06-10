// app.js — Entry point for the Channel Service
// This is a separate microservice. Its ONLY job is:
// 1. Receive a "send message" request from CRM Backend
// 2. Simulate delivering it via WhatsApp / Email / SMS
// 3. Call back the CRM Backend with the delivery status (SENT / FAILED)

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Channel Service is running' });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`Channel Service running on http://localhost:${PORT}`);
});
