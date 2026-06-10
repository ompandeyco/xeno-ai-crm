// db.js — MongoDB connection logic
// We isolate the DB connection so app.js stays clean.
// This function is called once when the server starts.

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1); // Exit the process — no point running without a DB
  }
};

module.exports = connectDB;
