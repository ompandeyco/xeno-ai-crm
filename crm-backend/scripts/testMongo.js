// testMongo.js — Standalone MongoDB Atlas connection test.
// Run with: node scripts/testMongo.js
// PURPOSE: Verify credentials work in total isolation from Express/app.js.
//          If this succeeds and the app still fails, the bug is in the app layer.

const path     = require('path');
const dotenv   = require('dotenv');
const mongoose = require('mongoose');

// Always load from crm-backend/.env regardless of CWD
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Safe debug: never print password ─────────────────────────────────────────
console.log({
  mongoExists : !!process.env.MONGO_URI,
  mongoHost   : process.env.MONGO_URI?.split('@')[1],   // host only, no credentials
});

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error('❌ MONGO_URI is undefined — .env was not loaded or is missing.');
  process.exit(1);
}

(async () => {
  try {
    console.log('\n🔌 Attempting mongoose.connect() ...');
    const conn = await mongoose.connect(uri);
    console.log('✅ MongoDB Atlas connected successfully!');
    console.log('   Host    :', conn.connection.host);
    console.log('   DB name :', conn.connection.name);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected. Test complete.');
    process.exit(0);
  }
})();
