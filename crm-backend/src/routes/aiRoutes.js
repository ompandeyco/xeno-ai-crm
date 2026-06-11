// aiRoutes.js — Routes for the AI Marketing Agent.
//
// Base path /api/ai is registered in app.js.
//
// ENDPOINT SUMMARY:
//   POST /api/ai/segment           → translate marketer goal → segment rules
//   POST /api/ai/message           → generate personalized message template
//   GET  /api/ai/insights/:id      → analyze campaign stats and suggest improvements
//
// WHY THESE THREE ENDPOINTS REPRESENT AI-NATIVE DESIGN:
// Each endpoint returns a TYPED, ACTIONABLE output — not conversational text.
// The product uses AI output to drive real features:
//   /segment  → feeds the campaign segment rule builder
//   /message  → auto-fills the campaign message field
//   /insights → populates the campaign analytics dashboard
// The marketer never writes a query or reads raw data — AI does both.

const express = require('express');
const router = express.Router();
const {
  generateSegment,
  generateMessage,
  generateInsights,
} = require('../controllers/aiController');

// POST /api/ai/segment
// Body: { goal: "natural language marketing intent" }
router.post('/segment', generateSegment);

// POST /api/ai/message
// Body: { goal, segment: { segmentName, rules }, channel }
router.post('/message', generateMessage);

// GET /api/ai/insights/:campaignId
// Fetches real stats from DB then returns AI analysis
router.get('/insights/:campaignId', generateInsights);

module.exports = router;
