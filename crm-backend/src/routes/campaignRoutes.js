// campaignRoutes.js — Maps HTTP verbs + paths to campaign controller functions.
//
// CRITICAL ROUTE ORDER:
// Express matches routes TOP TO BOTTOM in declaration order.
// '/receipt' and '/preview' MUST come before '/:id' — otherwise Express
// would try to treat the literal string "receipt" or "preview" as an
// ObjectId parameter, fail Mongoose validation, and throw a 500.
//
// Base path /api/campaigns is registered in app.js.

const express = require('express');
const router = express.Router();
const {
  createCampaign,
  getCampaigns,
  getCampaignById,
  previewAudience,
  sendCampaign,
  processDeliveryReceipt,
  getCampaignLogs,
} = require('../controllers/campaignController');

// ── Static routes FIRST ───────────────────────────────────────────────────────

// POST /api/campaigns/preview — audience dry run (no messages sent)
router.post('/preview', previewAudience);

// POST /api/campaigns/receipt — delivery callback from channel-service
router.post('/receipt', processDeliveryReceipt);

// ── Collection routes ─────────────────────────────────────────────────────────

// GET  /api/campaigns        → list all campaigns
// POST /api/campaigns        → create new campaign
router.route('/').get(getCampaigns).post(createCampaign);

// ── Dynamic routes AFTER static ───────────────────────────────────────────────

// GET  /api/campaigns/:id        → get one campaign
router.get('/:id', getCampaignById);

// POST /api/campaigns/:id/send   → launch campaign dispatch
router.post('/:id/send', sendCampaign);

// GET  /api/campaigns/:id/logs   → delivery logs for a campaign
router.get('/:id/logs', getCampaignLogs);

module.exports = router;
