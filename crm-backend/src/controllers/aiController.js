// aiController.js — HTTP layer for AI Marketing Agent endpoints.
//
// Same thin-controller pattern used throughout the CRM:
//   READ from req → CALL aiService → WRITE res
//
// No AI logic lives here. All prompts and Gemini calls are in aiService.js.
// Controllers only handle HTTP concerns: input validation, status codes, response shape.
//
// WHY THREE SEPARATE ENDPOINTS (not one "ask AI anything" endpoint)?
// This is AI-NATIVE design — not a chatbot.
// Each endpoint has a specific, typed input and a typed output.
// The output is immediately usable by the product (segment → campaign, etc.)
// A chatbot returns text. An AI-native system returns structured actions.

const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');
const Campaign = require('../models/Campaign');
const CommunicationLog = require('../models/CommunicationLog');

// ─── POST /api/ai/segment ─────────────────────────────────────────────────────
// Input:  { goal: "Bring back premium customers who haven't purchased recently" }
// Output: { segmentName, rules: { minSpend, inactiveDays }, reasoning, fallback }
//
// The frontend will use this response to pre-populate the segment rule builder.
// The marketer can review and tweak before launching.
const generateSegment = asyncHandler(async (req, res) => {
  const { goal } = req.body;

  if (!goal || typeof goal !== 'string' || goal.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'goal is required and must be a meaningful sentence (min 5 chars)',
    });
  }

  const result = await aiService.generateSegmentRules(goal.trim());

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ─── POST /api/ai/message ─────────────────────────────────────────────────────
// Input:  { goal, segment: { segmentName, rules }, channel }
// Output: { message, tone, reason, fallback }
//
// The returned message is a template ready to drop into a campaign.
// The {name} placeholder will be replaced at dispatch time by campaignService.
const generateMessage = asyncHandler(async (req, res) => {
  const { goal, segment, channel } = req.body;

  if (!goal) {
    return res.status(400).json({
      success: false,
      message: 'goal is required',
    });
  }

  const validChannels = ['email', 'whatsapp', 'sms'];
  const resolvedChannel = validChannels.includes(channel) ? channel : 'email';

  const result = await aiService.generateCampaignMessage({
    campaignGoal: goal,
    segment,
    channel: resolvedChannel,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ─── GET /api/ai/insights/:campaignId ────────────────────────────────────────
// Fetches the campaign's real stats from MongoDB, then asks AI to interpret them.
//
// WHY FETCH FROM DB (not accept stats in the request body)?
// If we let the client send stats, they could send fake numbers.
// Fetching from DB guarantees the AI is analyzing real data.
const generateInsights = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  // Load the campaign to get name, channel, and stats
  const campaign = await Campaign.findById(campaignId).select('name channel stats status');
  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: 'Campaign not found',
    });
  }

  // Only analyze campaigns that have been sent
  if (campaign.status === 'draft') {
    return res.status(400).json({
      success: false,
      message: 'Campaign has not been launched yet — no stats to analyze',
    });
  }

  const result = await aiService.generateCampaignInsights(
    campaign.stats,
    campaign.name,
    campaign.channel
  );

  res.status(200).json({
    success: true,
    data: {
      campaign: {
        id:      campaign._id,
        name:    campaign.name,
        channel: campaign.channel,
        status:  campaign.status,
        stats:   campaign.stats,
      },
      insights: result,
    },
  });
});

module.exports = {
  generateSegment,
  generateMessage,
  generateInsights,
};
