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
// PHASE 4 CHANGES:
//   - Endpoint changed to POST /channel/send (channel-service spec)
//   - Passes full customer object { name, email, phone }
//   - Uses 'communicationId' (the CommunicationLog _id) as the shared identifier
//   - Added retry logic: up to MAX_RETRIES attempts if channel-service is unreachable
//   - Retry count stored on CommunicationLog for auditing
//
// FLOW:
// 1. Resolve audience from segment rules
// 2. Set campaign status → 'sending'
// 3. For each customer:
//    a. Personalize message (replace {name})
//    b. Create CommunicationLog (status: 'pending') — the communicationId
//    c. POST to channel-service: POST /channel/send with retry
//    d. If channel-service accepts (202): increment stats.sent
//    e. If channel-service unreachable after retries: mark log failed
// 4. Set campaign status → 'completed'
//
// IMPORTANT: We do NOT wait for delivery receipts.
// The dispatch loop fires the request and moves on.
// Receipts come back asynchronously to POST /api/receipts/channel.

const MAX_RETRIES = 3; // Maximum attempts to reach channel-service
const RETRY_DELAY_MS = 500; // Wait 500ms between retry attempts

// ─── Helper: sleep for ms milliseconds ───────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Helper: POST to channel-service with retry ───────────────────────────────
// Retries up to MAX_RETRIES times on network failure.
// Returns { success: boolean, retryCount: number }
//
// WHY RETRY HERE (not in channel-service)?
// The CRM is the producer — it owns the responsibility of ensuring the message
// gets accepted by the channel-service. If the channel-service is briefly down,
// retrying here is cheap and doesn't require a queue.
//
// In production: This retry logic would be replaced by publishing to a
// message queue (Kafka / SQS). The queue provides durable retry with
// exponential backoff without blocking the Node.js event loop.
const postToChannelServiceWithRetry = async (channelServiceUrl, payload) => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios.post(`${channelServiceUrl}/channel/send`, payload);
      return { success: true, retryCount: attempt - 1 };
    } catch (err) {
      lastError = err;
      console.warn(
        `[CAMPAIGN-SERVICE] Channel-service attempt ${attempt}/${MAX_RETRIES} failed for communicationId ${payload.communicationId}: ${err.message}`
      );
      if (attempt < MAX_RETRIES) {
        // In production this can move to exponential backoff (attempt * RETRY_DELAY_MS)
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  return { success: false, retryCount: MAX_RETRIES, error: lastError };
};

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
  // Select all fields needed by channel-service: name (personalization),
  // email + phone (delivery identifiers), engagement (preferred channel info)
  const audience = await Customer.find(query).select('name email phone engagement');

  if (audience.length === 0) {
    const error = new Error('No customers matched the segment rules — campaign not sent');
    error.statusCode = 400;
    throw error;
  }

  // ── 3. Mark campaign as 'sending' ────────────────────────────────────────
  campaign.status = 'sending';
  campaign.stats.audienceSize = audience.length;
  campaign.stats.sent = 0;
  campaign.stats.delivered = 0;
  campaign.stats.opened = 0;
  campaign.stats.clicked = 0;
  campaign.stats.failed = 0;
  await campaign.save();

  // ── 4. Dispatch to each customer ──────────────────────────────────────────
  // Promise.allSettled: if one customer fails, others continue unaffected.
  const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5002';

  const dispatchPromises = audience.map(async (customer) => {
    // Personalize: replace {name} with customer's first name
    const personalizedMessage = campaign.message.replace(
      /\{name\}/gi,
      customer.name.split(' ')[0]
    );

    // Create CommunicationLog BEFORE the HTTP call.
    // This guarantees a log record exists even if channel-service is unreachable.
    // The _id of this document IS the communicationId shared with channel-service.
    const communication = await CommunicationLog.create({
      campaignId:    campaign._id,
      customerId:    customer._id,
      message:       personalizedMessage,
      channel:       campaign.channel,
      currentStatus: 'pending',
      statusHistory: [{ status: 'pending', timestamp: new Date() }],
      retryCount:    0,
    });

    // Build payload for channel-service
    const payload = {
      communicationId: communication._id, // shared identifier for callback receipts
      customer: {
        name:  customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      channel: campaign.channel,
      message: personalizedMessage,
    };

    // POST to channel-service with retry
    const result = await postToChannelServiceWithRetry(channelServiceUrl, payload);

    if (result.success) {
      // Channel-service accepted — increment sent counter
      // Note: retryCount > 0 means it succeeded but needed retries — worth monitoring
      await CommunicationLog.findByIdAndUpdate(communication._id, {
        retryCount: result.retryCount,
      });
      await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.sent': 1 } });
    } else {
      // All retries exhausted — channel-service is unreachable
      // Mark the log as failed immediately (no channel involvement)
      console.error(
        `[CAMPAIGN-SERVICE] Channel-service unreachable after ${MAX_RETRIES} retries for customer ${customer._id}`
      );
      await CommunicationLog.findByIdAndUpdate(communication._id, {
        currentStatus: 'failed',
        retryCount:    MAX_RETRIES,
        failureReason: 'Channel service unreachable after max retries',
        $push: {
          statusHistory: {
            status:    'failed',
            timestamp: new Date(),
            metadata:  'Channel service unreachable after max retries',
          },
        },
      });
      await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.failed': 1 } });
    }
  });

  await Promise.allSettled(dispatchPromises);

  // ── 5. Mark campaign as completed ─────────────────────────────────────────
  await Campaign.findByIdAndUpdate(campaignId, { status: 'completed' });

  return Campaign.findById(campaignId);
};

// ─── GET logs for a campaign ──────────────────────────────────────────────────
// Returns all CommunicationLog documents for a campaign with customer details.
// Used by the campaign detail view to show per-customer delivery status.
const getCampaignLogs = async (campaignId) => {
  const logs = await CommunicationLog.find({ campaignId })
    .populate('customerId', 'name email') // Join customer name + email
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
  getCampaignLogs,
};

