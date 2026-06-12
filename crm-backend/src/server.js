// server.js — The actual Node.js process entry point.
//
// BOOT ORDER (this sequence matters):
// 1. Load environment variables FIRST so everything else can read them
// 2. Connect to MongoDB — if this fails we abort immediately
// 3. Only THEN start listening for HTTP traffic
//
// This prevents a race condition where requests arrive before DB is ready.

const path   = require('path');
const dotenv = require('dotenv');

// EXPLICIT PATH — guarantees we always load crm-backend/.env regardless of
// which directory the process is started from (e.g. repo root vs crm-backend/).
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Safe debug: confirm MONGO_URI loaded (password is NOT printed) ──────────
console.log('[boot] MONGO_URI loaded:', !!process.env.MONGO_URI);
if (process.env.MONGO_URI) {
  const uri = process.env.MONGO_URI;
  // Show only scheme + username + host — never the password
  const safeUri = uri.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  console.log('[boot] MONGO_URI (safe):', safeUri);
} else {
  console.error('[boot] ❌ MONGO_URI is undefined — check crm-backend/.env exists and is populated');
}

const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 5001;

// Self-invoking async function — allows us to use await at the top level
const startServer = async () => {
  try {
    // Step 1: Connect to MongoDB before opening the HTTP port
    await connectDB();

    // Step 2: Start accepting HTTP requests only after DB is ready
    app.listen(PORT, () => {
      console.log(`🚀 CRM Backend running on http://localhost:${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
