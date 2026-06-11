// receiptRoutes.js — Routes for delivery receipt callbacks from channel-service.
//
// Base path /api/receipts is registered in app.js.
//
// WHY A SEPARATE ROUTE FILE (not inside campaignRoutes)?
// Receipts are machine-to-machine calls, not user-facing.
// Keeping them in their own namespace (/api/receipts) makes it easy to:
//   1. Add auth middleware only to this router (shared secret / HMAC verification)
//   2. Rate-limit differently (receipts can come in bursts of thousands)
//   3. Replace this HTTP endpoint with a Kafka consumer in production

const express = require('express');
const router = express.Router();
const { handleChannelReceipt } = require('../controllers/receiptController');

// POST /api/receipts/channel
// Called by channel-service after each status event in the delivery lifecycle.
// Accepts: { communicationId, status, timestamp, metadata? }
router.post('/channel', handleChannelReceipt);

module.exports = router;
