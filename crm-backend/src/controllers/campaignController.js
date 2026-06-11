// campaignController.js — HTTP layer for campaign endpoints.
//
// PHASE 4 CHANGES:
//   - Renamed sendCampaign → launchCampaign (route: /launch instead of /send)
//   - Removed processDeliveryReceipt — moved to receiptController.js
//     Receipts are now machine-to-machine at POST /api/receipts/channel
//
// Pattern: READ from req → CALL service → WRITE res
// Zero business logic lives here. All decisions are in campaignService.js.

const asyncHandler = require('../utils/asyncHandler');
const campaignService = require('../services/campaignService');

// ─── POST /api/campaigns ──────────────────────────────────────────────────────
// Create a new campaign (status defaults to 'draft')
const createCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.createCampaign(req.body);

  res.status(201).json({
    success: true,
    message: 'Campaign created',
    data: campaign,
  });
});

// ─── GET /api/campaigns ───────────────────────────────────────────────────────
// List all campaigns, newest first
const getCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await campaignService.getCampaigns();

  res.status(200).json({
    success: true,
    count: campaigns.length,
    data: campaigns,
  });
});

// ─── GET /api/campaigns/:id ───────────────────────────────────────────────────
// Get a single campaign by ID
const getCampaignById = asyncHandler(async (req, res) => {
  const campaign = await campaignService.getCampaignById(req.params.id);

  res.status(200).json({
    success: true,
    data: campaign,
  });
});

// ─── POST /api/campaigns/preview ─────────────────────────────────────────────
// Dry-run: given segment rules, return audience count + sample customers.
// The marketer can see who they're targeting BEFORE launching.
//
// Body: { segmentRules: [{ field, operator, value }, ...] }
const previewAudience = asyncHandler(async (req, res) => {
  const { segmentRules } = req.body;

  if (!segmentRules) {
    return res.status(400).json({
      success: false,
      message: 'segmentRules array is required in request body',
    });
  }

  const result = await campaignService.previewAudience(segmentRules);

  res.status(200).json({
    success: true,
    data: {
      audienceCount: result.count,
      sampleCustomers: result.sample,
    },
  });
});

// ─── POST /api/campaigns/:id/launch ──────────────────────────────────────────
// Launch the campaign: resolve audience, dispatch messages, trigger delivery lifecycle.
//
// PHASE 4: Renamed from /send to /launch.
// WHY 'launch'? 'send' implies synchronous delivery. 'launch' implies triggering
// an asynchronous process — which is exactly what this does. The response comes
// back immediately with dispatch stats; delivery receipts arrive later via callbacks.
const launchCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.sendCampaign(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Campaign launched — messages dispatched to channel-service',
    data: campaign,
  });
});

// ─── GET /api/campaigns/:id/logs ─────────────────────────────────────────────
// Return all CommunicationLog records for a campaign.
// PHASE 4: Each log now includes statusHistory[] with the full event chain.
const getCampaignLogs = asyncHandler(async (req, res) => {
  const logs = await campaignService.getCampaignLogs(req.params.id);

  res.status(200).json({
    success: true,
    count: logs.length,
    data: logs,
  });
});

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById,
  previewAudience,
  launchCampaign,
  getCampaignLogs,
};
