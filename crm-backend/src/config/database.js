// database.js — MongoDB connection with proper lifecycle management.
// Called ONCE from server.js before the server starts listening.
// Separating DB connection from app.js means the connection is testable independently.

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // mongoose.connect() returns a connection object with metadata
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options silence deprecation warnings in Mongoose 7+
      // Mongoose 8 sets them by default, but explicit is better for readability
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Log when connection drops — important for debugging production issues
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB error: ${err.message}`);
    });

  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    // process.exit(1) stops the Node process entirely.
    // There is no reason to keep running if we have no database.
    process.exit(1);
  }
};

module.exports = connectDB;
