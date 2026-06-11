// aiService.js — The AI layer for the Xeno CRM Marketing Agent.
//
// ═══════════════════════════════════════════════════════════════════
// WHY A SEPARATE AI SERVICE LAYER?
// ═══════════════════════════════════════════════════════════════════
// 1. SINGLE RESPONSIBILITY: All Gemini API calls live here.
//    If we swap Gemini for GPT-4 or Claude tomorrow, only this file changes.
//    No controller, route, or model needs to know which AI provider we use.
//
// 2. PROMPT MANAGEMENT: Prompts are complex, versioned artifacts.
//    Keeping them here (not in controllers) makes them easy to iterate,
//    A/B test, and review as a unit.
//
// 3. CONTROLLED OUTPUT: All functions in this file enforce JSON output.
//    WHY JSON? Because the CRM uses AI output to trigger real actions
//    (creating segments, dispatching campaigns). Freeform text is unusable.
//    JSON gives us structured, validated, machine-readable intent.
//
// 4. FALLBACK SAFETY: Every function has a hardcoded fallback.
//    If Gemini is down, rate-limited, or returns garbage, the product
//    continues working with conservative defaults. AI failure ≠ product failure.
//
// ═══════════════════════════════════════════════════════════════════
// HOW HALLUCINATIONS ARE CONTROLLED
// ═══════════════════════════════════════════════════════════════════
// 1. SCHEMA ENFORCEMENT: We tell Gemini exactly what JSON shape to return.
//    Any field outside that shape is stripped during validation.
// 2. TEMPERATURE=0.2: Low temperature = more deterministic, less creative.
//    For business logic (segment rules), we want precision over creativity.
// 3. POST-PARSE VALIDATION: After parsing, we check types and clamp numeric
//    values to safe ranges (e.g. inactiveDays cannot be 0 or 9999).
// 4. FALLBACK: If validation fails, we use safe hardcoded defaults instead
//    of letting bad AI output reach the database.

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Initialize Gemini client ─────────────────────────────────────────────────
// Initialized once at module load time (singleton pattern).
// If GEMINI_API_KEY is missing, we log a warning but don't crash —
// fallback responses will be used for all AI calls.
let genAI = null;
let model = null;

const initGemini = () => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn('[AI-SERVICE] GEMINI_API_KEY not set — AI features will use fallback responses');
    return false;
  }

  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // gemini-1.5-flash: fast, cheap, excellent for structured JSON output.
  // In production: use gemini-1.5-pro for higher accuracy on complex goals.
  model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      // Temperature controls randomness: 0 = deterministic, 1 = creative.
      // We use 0.2 for segment rules (precision matters) and 0.7 for messages (creativity OK).
      temperature: 0.2,

      // responseMimeType: forces Gemini to return valid JSON.
      // Without this, Gemini sometimes wraps JSON in markdown code blocks (```json...```)
      // which breaks JSON.parse(). This eliminates that entire class of bugs.
      responseMimeType: 'application/json',
    },
  });

  return true;
};

// Initialize on module load
const isGeminiReady = initGemini();

// ─── Helper: call Gemini and parse JSON response ───────────────────────────────
// Centralizes the try/catch, JSON parsing, and timeout logic.
// Returns { data: parsedObject } on success or { error: string } on failure.
const callGemini = async (prompt, temperature = 0.2) => {
  if (!isGeminiReady || !model) {
    return { error: 'Gemini not initialized' };
  }

  try {
    // Override temperature per-call if needed
    const callModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    });

    const result = await callModel.generateContent(prompt);
    const text = result.response.text();

    // Parse the JSON response
    const parsed = JSON.parse(text);
    return { data: parsed };
  } catch (err) {
    console.error(`[AI-SERVICE] Gemini call failed: ${err.message}`);
    return { error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════════
// FUNCTION 1: generateSegmentRules
// ═══════════════════════════════════════════════════════════════════
//
// INPUT:  userGoal — a natural-language marketing goal
//         e.g. "Bring back premium customers who haven't purchased recently"
//
// OUTPUT: {
//   segmentName: string,
//   rules: { minSpend: number, inactiveDays: number },
//   reasoning: string
// }
//
// HOW THE PROMPT IS DESIGNED:
// We give Gemini the role of a "marketing intelligence engine" (not a chatbot).
// We show it the EXACT JSON schema we expect.
// We constrain the output with business rules (e.g. inactiveDays 7–365).
// We use "respond ONLY with valid JSON" to prevent markdown wrapping.
//
// FALLBACK: If Gemini fails, return conservative defaults that work for most goals.

const SEGMENT_FALLBACK = {
  segmentName: 'High-value customers',
  rules: { minSpend: 5000, inactiveDays: 60 },
  reasoning: 'Default segment targeting customers with meaningful spend history who have gone quiet.',
};

const generateSegmentRules = async (userGoal) => {
  const prompt = `
You are a marketing intelligence engine for a consumer brand CRM.
A marketer has described a campaign goal. Your job is to translate that goal
into a precise customer segment definition.

MARKETER'S GOAL:
"${userGoal}"

RULES FOR YOUR RESPONSE:
- minSpend: minimum total historical spend in INR (integer, between 0 and 500000)
- inactiveDays: how many days the customer has NOT purchased (integer, between 7 and 365)
- segmentName: a short, clear name for this segment (max 60 chars)
- reasoning: one sentence explaining WHY these thresholds match the goal

Respond ONLY with this exact JSON structure, no other text:
{
  "segmentName": "...",
  "rules": {
    "minSpend": <number>,
    "inactiveDays": <number>
  },
  "reasoning": "..."
}
`;

  const { data, error } = await callGemini(prompt, 0.2);

  if (error || !data) {
    console.warn(`[AI-SERVICE] generateSegmentRules fallback triggered: ${error}`);
    return { ...SEGMENT_FALLBACK, fallback: true };
  }

  // ── Validate and sanitize the response ───────────────────────────────────
  // We never trust AI output blindly. Check types, clamp to safe ranges.
  const rules = data.rules || {};
  const minSpend    = Math.max(0,   Math.min(500000, parseInt(rules.minSpend,    10) || 5000));
  const inactiveDays = Math.max(7, Math.min(365,    parseInt(rules.inactiveDays, 10) || 60));

  return {
    segmentName: String(data.segmentName || SEGMENT_FALLBACK.segmentName).slice(0, 60),
    rules: { minSpend, inactiveDays },
    reasoning:  String(data.reasoning  || SEGMENT_FALLBACK.reasoning),
    fallback: false,
  };
};

// ═══════════════════════════════════════════════════════════════════
// FUNCTION 2: generateCampaignMessage
// ═══════════════════════════════════════════════════════════════════
//
// INPUT:  { campaignGoal, segment, channel }
//         campaignGoal: the marketer's intent
//         segment: { segmentName, rules } — context for personalization
//         channel: 'email' | 'whatsapp' | 'sms'
//
// OUTPUT: { message: string, tone: string, reason: string }
//
// WHY {{name}} PLACEHOLDER?
// The CRM replaces {{name}} at dispatch time with each customer's actual name.
// We use {{name}} (not {name}) here to match common template conventions
// and distinguish it from JavaScript template literals.
// Note: campaignService.js replaces {name} — both work; consistency matters.
//
// CHANNEL-AWARE PROMPTING:
// WhatsApp: informal, emoji OK, short
// Email: can be longer, more formal
// SMS: MUST be under 160 chars, no emoji

const MESSAGE_FALLBACK = {
  message: 'Hi {{name}}, we have an exclusive offer just for you. Come back and save 20% on your next order!',
  tone: 'friendly',
  reason: 'Default comeback message with discount incentive.',
  fallback: true,
};

const generateCampaignMessage = async ({ campaignGoal, segment, channel }) => {
  const channelGuidelines = {
    whatsapp: 'Keep it under 200 chars. Conversational and warm. Emoji are OK.',
    sms:      'MUST be under 160 chars. No emoji. Direct and urgent.',
    email:    'Can be up to 300 chars. Professional but personable. Clear CTA.',
  };

  const guideline = channelGuidelines[channel] || channelGuidelines.email;

  const prompt = `
You are a senior CRM copywriter for a consumer brand.
Write a re-engagement message for the following campaign.

CAMPAIGN GOAL: "${campaignGoal}"
TARGET SEGMENT: "${segment?.segmentName || 'valued customers'}"
CHANNEL: ${channel?.toUpperCase() || 'EMAIL'}
CHANNEL RULES: ${guideline}

REQUIREMENTS:
- Use {{name}} as the placeholder for the customer's first name
- The message must feel personal, not generic
- Include a clear call-to-action
- Do NOT include subject lines, headers, or sign-offs
- Match the tone to the channel (see channel rules above)

Respond ONLY with this exact JSON, no other text:
{
  "message": "...",
  "tone": "friendly | urgent | professional | empathetic",
  "reason": "One sentence explaining the copywriting approach"
}
`;

  const { data, error } = await callGemini(prompt, 0.7); // Higher temperature for creativity

  if (error || !data || !data.message) {
    console.warn(`[AI-SERVICE] generateCampaignMessage fallback triggered: ${error}`);
    return MESSAGE_FALLBACK;
  }

  // Validate: message must contain {{name}} and not be empty
  let message = String(data.message || '').trim();
  if (!message) return MESSAGE_FALLBACK;

  // If AI forgot the placeholder, prepend it
  if (!message.includes('{{name}}') && !message.includes('{name}')) {
    message = `Hi {{name}}, ${message}`;
  }

  return {
    message,
    tone:    String(data.tone   || 'friendly'),
    reason:  String(data.reason || 'AI-generated campaign message'),
    fallback: false,
  };
};

// ═══════════════════════════════════════════════════════════════════
// FUNCTION 3: generateCampaignInsights
// ═══════════════════════════════════════════════════════════════════
//
// INPUT:  Campaign stats object { sent, delivered, opened, clicked, failed }
//         Plus optional campaignName and channel for richer context.
//
// OUTPUT: { summary: string, recommendations: string[] }
//
// HOW THIS IS AI-NATIVE (not just a chatbot):
// The AI doesn't just describe the numbers — it interprets them against
// industry benchmarks (e.g. "email open rate < 20% is below industry average")
// and recommends concrete ACTIONS the marketer should take next.
// This is decision-support intelligence, not Q&A.

const generateCampaignInsights = async (stats, campaignName = '', channel = '') => {
  const { audienceSize = 0, sent = 0, delivered = 0, opened = 0, clicked = 0, failed = 0 } = stats;

  // Calculate actual rates
  const deliveryRateVal = sent > 0 ? (delivered / sent) : 0;
  const openRateVal     = delivered > 0 ? (opened / delivered) : 0;
  const clickRateVal    = delivered > 0 ? (clicked / delivered) : 0;

  // Pre-compute percentages for the prompt
  const deliveryRate = (deliveryRateVal * 100).toFixed(1);
  const openRate     = (openRateVal * 100).toFixed(1);
  const clickRate    = (clickRateVal * 100).toFixed(1);
  const failureRate  = sent > 0 ? ((failed / sent) * 100).toFixed(1) : '0';

  const getDynamicFallback = () => {
    let summary = '';
    const recommendations = [];

    const formattedChannel = channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : 'The';

    if (openRateVal >= 0.4) {
      summary = `Strong engagement detected. ${formattedChannel} campaign achieved ~${Math.round(openRateVal * 100)}% open rate and ~${Math.round(clickRateVal * 100)}% click rate. Similar audiences can be targeted again.`;
      recommendations.push("Consider increasing the audience size for similar campaigns.");
      recommendations.push("Reuse the message copy as it proved highly effective.");
    } else if (openRateVal < 0.2) {
      summary = `Audience reached successfully but message engagement was weak. Try changing copy or channel.`;
      recommendations.push("Experiment with different subject lines or introductory text.");
      recommendations.push(`Test if this segment responds better on a channel other than ${channel || 'this one'}.`);
    } else {
      summary = `Campaign delivered to ${delivered} contacts with an open rate of ${openRate}%. Performance is moderate.`;
      recommendations.push("Try A/B testing different messages to improve engagement.");
      recommendations.push("Refine the audience segment for better targeting.");
    }

    if (deliveryRateVal < 0.8 && sent > 0) {
      recommendations.push(`Delivery rate was low (${deliveryRate}%). Please check your contact list for invalid addresses/numbers.`);
    }

    return {
      summary,
      recommendations,
      fallback: true
    };
  };

  const dynamicFallback = getDynamicFallback();

  const prompt = `
You are a senior marketing analyst for a consumer brand CRM.
Analyze the following campaign performance and provide actionable insights.

CAMPAIGN: "${campaignName || 'Unnamed campaign'}"
CHANNEL: ${channel?.toUpperCase() || 'UNKNOWN'}

PERFORMANCE DATA:
- Audience Size:     ${audienceSize}
- Messages Sent:     ${sent}
- Delivered:         ${delivered} (${deliveryRate}% delivery rate)
- Opened:            ${opened} (${openRate}% open rate of delivered)
- Clicked:           ${clicked} (${clickRate}% click rate of delivered)
- Failed:            ${failed} (${failureRate}% failure rate)

INDUSTRY BENCHMARKS FOR REFERENCE:
- Email: delivery 95%+, open 20-25%, click 2-5%
- WhatsApp: delivery 90%+, open 70-80%, click 10-20%
- SMS: delivery 90%+, open 35-50%, click 5-10%

TASK:
1. Write a 1-2 sentence plain-English summary of how the campaign performed.
2. Give 2-4 specific, actionable recommendations to improve future campaigns.
   Each recommendation should be a concrete action, not a vague suggestion.

Respond ONLY with this exact JSON, no other text:
{
  "summary": "...",
  "recommendations": ["...", "...", "..."]
}
`;

  const { data, error } = await callGemini(prompt, 0.3);

  if (error || !data) {
    console.warn(`[AI-SERVICE] generateCampaignInsights fallback triggered: ${error}`);
    return dynamicFallback;
  }

  // Validate recommendations is an array of strings
  const recommendations = Array.isArray(data.recommendations)
    ? data.recommendations.filter(r => typeof r === 'string').slice(0, 6)
    : dynamicFallback.recommendations;

  return {
    summary:         String(data.summary || dynamicFallback.summary),
    recommendations,
    fallback: false,
  };
};

module.exports = {
  generateSegmentRules,
  generateCampaignMessage,
  generateCampaignInsights,
};
