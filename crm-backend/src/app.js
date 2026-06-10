// app.js — Entry point for the CRM Backend Service
// This file boots Express, connects to MongoDB, and registers all routes.

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables from .env file FIRST (before anything else)
dotenv.config();

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());            // Allow requests from the frontend
app.use(morgan('dev'));     // Log every HTTP request in development
app.use(express.json());    // Parse incoming JSON request bodies

// ─── Health Check ────────────────────────────────────────────────────────────
// A simple route to verify the server is running
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'CRM Backend is running' });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`CRM Backend running on http://localhost:${PORT}`);
});
