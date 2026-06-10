// server.js — The actual Node.js process entry point.
//
// BOOT ORDER (this sequence matters):
// 1. Load environment variables FIRST so everything else can read them
// 2. Connect to MongoDB — if this fails we abort immediately
// 3. Only THEN start listening for HTTP traffic
//
// This prevents a race condition where requests arrive before DB is ready.

const dotenv = require('dotenv');
dotenv.config(); // Must be before any other import that reads process.env

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
