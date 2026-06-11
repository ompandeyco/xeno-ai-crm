// campaignService.js — Business logic for campaigns.
//
// THIS FILE HAS THREE RESPONSIBILITIES:
//
// 1. CAMPAIGN CRUD — create, list, get by ID
//
// 2. SEGMENT RESOLUTION — translate the array of { field, operator, value }
//    rules into a real MongoDB query, then return the matching customers.
//    e.g. [{ field: 'purchaseSummary.totalSpend', operator: 'gt', value: 5000 }]
//    → Customer.find({ 'purchaseSummary.totalSpend': { $gt: 5000 } })
//
// 3. CAMPAIGN DISPATCH — loop over the resolved audience, create a CommunicationLog
//    for each customer, then POST to the channel-service for delivery.
//    This fires-and-forgets the HTTP call — delivery receipts come back via callback.

const axios = require('axios');
const Campaign = require('../models/Campaign');
const Customer = require('../models/Customer');
const CommunicationLog = require('../models/CommunicationLog');

// ─── Operator map: rule operator → MongoDB query operator ─────────────────────
// The rule stores human-readable operators ('gt', 'lte', 'eq', etc.)
// MongoDB needs its own syntax ($gt, $lte, $eq, etc.)
const OPERATOR_MAP = {
  gt:  '$gt',
  gte: '$gte',
  lt:  '$lt',
  lte: '$lte',
  eq:  '$eq',
  ne:  '$ne',
};

// ─── buildMongoQuery — Convert segment rules → MongoDB filter object ──────────
// Called internally by resolveAudience and previewAudience.
//
// Input:  [{ field: 'attributes.city', operator: 'eq', value: 'Mumbai' },
//           { field: 'purchaseSummary.totalSpend', operator: 'gt', value: 5000 }]
//
// Output: { 'attributes.city': { $eq: 'Mumbai' },
//           'purchaseSummary.totalSpend': { $gt: 5000 } }
//
// Rules with the same field are merged — last one wins (edge case, rare in practice).
const buildMongoQuery = (segmentRules) => {
  const query = {};

  for (const rule of segmentRules) {
    const mongoOperator = OPERATOR_MAP[rule.operator];
    if (!mongoOperator) {
      throw new Error(`Unknown operator: ${rule.operator}. Valid: gt, gte, lt, lte, eq, ne`);
    }
    query[rule.field] = { [mongoOperator]: rule.value };
  }

  return query;
};

// ─── CREATE a new campaign ────────────────────────────────────────────────────
const createCampaign = async (campaignData) => {
  const campaign = await Campaign.create(campaignData);
  return campaign;
};

// ─── LIST all campaigns ───────────────────────────────────────────────────────
// Newest first. We never paginate campaigns (typically < 100 per brand).
const getCampaigns = async () => {
  const campaigns = await Campaign.find().sort({ createdAt: -1 }).select('-__v');
  return campaigns;
};

// ─── GET a single campaign by ID ──────────────────────────────────────────────
const getCampaignById = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId).select('-__v');
  if (!campaign) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }
  return campaign;
};

// ─── PREVIEW audience — dry run, does NOT send messages ───────────────────────
// Returns the count and a sample of 5 customers that would be targeted.
// Used by the UI so the marketer can see audience size before launching.
const previewAudience = async (segmentRules) => {
  const query = buildMongoQuery(segmentRules);

  // Run count and sample in parallel for speed
  const [count, sample] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query).limit(5).select('name email attributes.city purchaseSummary'),
  ]);

  return { count, sample };
};

// ─── SEND CAMPAIGN — the main dispatch engine ─────────────────────────────────
//
// HOW THIS WORKS (step by step):
//
// 1. Resolve the audience — query customers matching segment rules
// 2. Set campaign status to 'sending'
// 3. Store campaign.stats.audienceSize
// 4. For each customer:
//    a. Personalize the message (replace {name} with customer.name)
//    b. Create a CommunicationLog document with status 'pending'
//    c. POST to channel-service: { logId, customerId, channel, message }
//       The channel-service will simulate delivery and call us back at
//       POST /api/campaigns/receipt with { logId, status: 'sent'|'failed' }
// 5. Set campaign status to 'completed'
//
// IMPORTANT: We do NOT wait for delivery receipts here.
// The dispatch loop just fires the request. Receipts are async callbacks.
// This is realistic — in real systems, SMS/email delivery is never synchronous.
const sendCampaign = async (campaignId) => {
  // ── 1. Load campaign ──────────────────────────────────────────────────────
  const campaign = await getCampaignById(campaignId);

  if (campaign.status === 'sending') {
    const error = new Error('Campaign is already being sent');
    error.statusCode = 409;
    throw error;
  }
  if (campaign.status === 'completed') {
    const error = new Error('Campaign has already been sent');
    error.statusCode = 409;
    throw error;
  }

  // ── 2. Resolve audience ───────────────────────────────────────────────────
  const query = buildMongoQuery(campaign.segmentRules);
  const audience = await Customer.find(query).select('name email phone engagement');

  if (audience.length === 0) {
    const error = new Error('No customers matched the segment rules — campaign not sent');
    error.statusCode = 400;
    throw error;
  }

  // ── 3. Mark campaign as 'sending' and record audience size ───────────────
  campaign.status = 'sending';
  campaign.stats.audienceSize = audience.length;
  campaign.stats.sent = 0;
  campaign.stats.delivered = 0;
  campaign.stats.failed = 0;
  await campaign.save();

  // ── 4. Dispatch to each customer ──────────────────────────────────────────
  // We use Promise.allSettled so one failed HTTP call doesn't abort the rest.
  const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5002';

  const dispatchPromises = audience.map(async (customer) => {
    // Personalize message: replace {name} placeholder with customer's first name
    const personalizedMessage = campaign.message.replace(
      /\{name\}/gi,
      customer.name.split(' ')[0]
    );

    // Create a log record BEFORE sending — so we have a record even if the
    // HTTP call to channel-service fails mid-way
    const log = await CommunicationLog.create({
      campaignId: campaign._id,
      customerId: customer._id,
      message:    personalizedMessage,
      channel:    campaign.channel,
      status:     'pending',
    });

    // Fire-and-forget POST to channel-service
    // We catch errors here so one failure doesn't kill the loop
    try {
      await axios.post(`${channelServiceUrl}/api/messages/send`, {
        logId:      log._id,
        customerId: customer._id,
        channel:    campaign.channel,
        message:    personalizedMessage,
      });

      // Increment sent counter — channel-service received our request
      await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.sent': 1 } });
    } catch (err) {
      // If channel-service is unreachable, mark the log as failed immediately
      console.error(`[CAMPAIGN-SERVICE] Failed to reach channel-service for customer ${customer._id}: ${err.message}`);
      await CommunicationLog.findByIdAndUpdate(log._id, {
        status: 'failed',
        failureReason: 'Channel service unreachable',
      });
      await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.failed': 1 } });
    }
  });

  await Promise.allSettled(dispatchPromises);

  // ── 5. Mark campaign as completed ─────────────────────────────────────────
  await Campaign.findByIdAndUpdate(campaignId, { status: 'completed' });

  // Return the updated campaign with final stats
  return Campaign.findById(campaignId);
};

// ─── RECEIPT HANDLER — called by channel-service callback ─────────────────────
// When the channel-service finishes delivery (or fails), it POSTs:
//   { logId: '...', status: 'sent' | 'failed', failureReason: '...' }
//
// We update the CommunicationLog and increment campaign stats accordingly.
const processDeliveryReceipt = async ({ logId, status, failureReason }) => {
  // Find the log first so we know which campaign to update stats for
  const log = await CommunicationLog.findById(logId);
  if (!log) {
    const error = new Error(`CommunicationLog ${logId} not found`);
    error.statusCode = 404;
    throw error;
  }

  // Prevent double-processing if the callback is sent twice (network retry)
  if (log.status !== 'pending') {
    return log; // Already processed — return early, no-op
  }

  // Update the log
  const updatedLog = await CommunicationLog.findByIdAndUpdate(
    logId,
    {
      status,
      deliveredAt:   status === 'sent' ? new Date() : null,
      failureReason: status === 'failed' ? (failureReason || 'Unknown') : null,
    },
    { new: true }
  );

  // Update campaign stats: increment 'delivered' or 'failed' counter
  const statField = status === 'sent' ? 'stats.delivered' : 'stats.failed';
  await Campaign.findByIdAndUpdate(log.campaignId, {
    $inc: { [statField]: 1 },
  });

  return updatedLog;
};

// ─── GET logs for a campaign ──────────────────────────────────────────────────
// Used by the campaign detail view to show per-customer delivery status.
const getCampaignLogs = async (campaignId) => {
  const logs = await CommunicationLog.find({ campaignId })
    .populate('customerId', 'name email') // Attach customer name + email to each log
    .sort({ createdAt: -1 })
    .select('-__v');
  return logs;
};

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById,
  previewAudience,
  sendCampaign,
  processDeliveryReceipt,
  getCampaignLogs,
};
