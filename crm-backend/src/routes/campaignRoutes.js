// campaignRoutes.js — Maps HTTP verbs + paths to campaign controller functions.
//
// PHASE 4 CHANGES:
//   - /receipt route REMOVED — receipts now go to /api/receipts/channel (dedicated router)
//   - /:id/send RENAMED to /:id/launch — semantically clearer for async dispatch
//
// CRITICAL ROUTE ORDER:
// Express matches routes TOP TO BOTTOM.
// '/preview' MUST come before '/:id' — otherwise Express treats the literal
// string "preview" as an ObjectId parameter → Mongoose cast error → 500.
//
// Base path /api/campaigns is registered in app.js.

const express = require('express');
const router = express.Router();
const {
  createCampaign,
  getCampaigns,
  getCampaignById,
  previewAudience,
  launchCampaign,
  getCampaignLogs,
} = require('../controllers/campaignController');

// ── Static routes FIRST (must come before /:id) ───────────────────────────────

// POST /api/campaigns/preview — audience dry run, no messages sent
router.post('/preview', previewAudience);

// ── Collection routes ─────────────────────────────────────────────────────────

// GET  /api/campaigns → list all campaigns
// POST /api/campaigns → create new campaign
router.route('/').get(getCampaigns).post(createCampaign);

// ── Dynamic routes AFTER static ───────────────────────────────────────────────

// GET  /api/campaigns/:id          → get one campaign with stats
router.get('/:id', getCampaignById);

// POST /api/campaigns/:id/launch   → launch campaign dispatch (PHASE 4: was /send)
router.post('/:id/launch', launchCampaign);

// GET  /api/campaigns/:id/logs     → per-customer delivery logs with statusHistory
router.get('/:id/logs', getCampaignLogs);

module.exports = router;
