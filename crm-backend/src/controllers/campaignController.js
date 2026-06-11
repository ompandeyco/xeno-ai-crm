// campaignController.js — HTTP layer for campaign endpoints.
//
// Same pattern as customerController:
//   READ from req → CALL service → WRITE res
//
// Zero business logic lives here. All decisions are made in campaignService.js.

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

// ─── POST /api/campaigns/:id/send ────────────────────────────────────────────
// Launch the campaign — resolves audience and dispatches messages.
// This is the main action that triggers the entire delivery pipeline.
const sendCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.sendCampaign(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Campaign dispatched successfully',
    data: campaign,
  });
});

// ─── POST /api/campaigns/receipt ─────────────────────────────────────────────
// Callback endpoint for the channel-service.
// Channel-service calls this after simulating delivery.
//
// Body: { logId, status: 'sent' | 'failed', failureReason?: string }
//
// NOTE: This route must be registered BEFORE '/:id' in the router,
// otherwise Express will try to match 'receipt' as a campaign ID (a 404).
const processDeliveryReceipt = asyncHandler(async (req, res) => {
  const { logId, status, failureReason } = req.body;

  if (!logId || !status) {
    return res.status(400).json({
      success: false,
      message: 'logId and status are required',
    });
  }

  const log = await campaignService.processDeliveryReceipt({ logId, status, failureReason });

  res.status(200).json({
    success: true,
    message: `Delivery receipt processed: ${status}`,
    data: log,
  });
});

// ─── GET /api/campaigns/:id/logs ─────────────────────────────────────────────
// Return all CommunicationLog records for a campaign.
// Used by the campaign detail view to show per-customer delivery status.
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
  sendCampaign,
  processDeliveryReceipt,
  getCampaignLogs,
};
