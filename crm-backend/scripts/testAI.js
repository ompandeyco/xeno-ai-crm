// testAI.js — API connectivity test for Phase 5 AI endpoints.
//
// PURPOSE:
// Verifies that all three AI routes are correctly registered and reachable.
// Does NOT test Gemini response quality — only that the endpoints exist,
// accept the correct input shape, and return a valid response envelope.
//
// Run with:  npm run test:ai
//
// The server (npm run dev) must be running on port 5001 before executing this.

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

// ─── ANSI color helpers ───────────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s) => `\x1b[2m${s}\x1b[0m`;

// ─── Result tracker ───────────────────────────────────────────────────────────
const results = [];

const pass = (name, detail = '') => {
  results.push({ name, passed: true });
  console.log(`  ${green('✓ PASSED')}  ${name}`);
  if (detail) console.log(`           ${dim(detail)}`);
};

const fail = (name, reason) => {
  results.push({ name, passed: false });
  console.log(`  ${red('✗ FAILED')}  ${name}`);
  console.log(`           ${red('→')} ${reason}`);
};

// ─── Individual test runners ──────────────────────────────────────────────────

// TEST 1 — POST /api/ai/segment
// Sends a natural-language goal and expects:
//   { success: true, data: { segmentName, rules: { minSpend, inactiveDays }, reasoning } }
const testSegment = async () => {
  const TEST_NAME = 'POST /api/ai/segment';
  try {
    const { data, status } = await axios.post(
      `${BASE_URL}/api/ai/segment`,
      { goal: 'I want to bring back rich customers who stopped shopping' },
      { timeout: 15000 }
    );

    // Validate HTTP status
    if (status !== 200) {
      return fail(TEST_NAME, `Expected HTTP 200, got ${status}`);
    }

    // Validate response envelope
    if (!data.success) {
      return fail(TEST_NAME, `success field is false: ${JSON.stringify(data)}`);
    }

    // Validate data shape
    const d = data.data;
    if (!d || typeof d.segmentName !== 'string') {
      return fail(TEST_NAME, `Missing or invalid segmentName in response`);
    }
    if (!d.rules || typeof d.rules.minSpend !== 'number' || typeof d.rules.inactiveDays !== 'number') {
      return fail(TEST_NAME, `Missing or invalid rules.minSpend / rules.inactiveDays`);
    }
    if (typeof d.reasoning !== 'string') {
      return fail(TEST_NAME, `Missing reasoning field`);
    }

    const source = d.fallback ? yellow('fallback') : green('Gemini');
    pass(TEST_NAME, `segment="${d.segmentName}" | minSpend=${d.rules.minSpend} | inactiveDays=${d.rules.inactiveDays} | source=${source}`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      fail(TEST_NAME, 'Connection refused — is the server running? (npm run dev)');
    } else {
      fail(TEST_NAME, err.response ? JSON.stringify(err.response.data) : err.message);
    }
  }
};

// TEST 2 — POST /api/ai/message
// Sends goal + segment + channel and expects:
//   { success: true, data: { message, tone, reason } }
const testMessage = async () => {
  const TEST_NAME = 'POST /api/ai/message';
  try {
    const { data, status } = await axios.post(
      `${BASE_URL}/api/ai/message`,
      {
        goal:    'Bring customers back',
        segment: 'premium inactive customers',
        channel: 'whatsapp',
      },
      { timeout: 15000 }
    );

    if (status !== 200) {
      return fail(TEST_NAME, `Expected HTTP 200, got ${status}`);
    }
    if (!data.success) {
      return fail(TEST_NAME, `success field is false: ${JSON.stringify(data)}`);
    }

    const d = data.data;
    if (!d || typeof d.message !== 'string' || d.message.trim() === '') {
      return fail(TEST_NAME, `Missing or empty message field`);
    }
    if (!d.message.includes('{{name}}') && !d.message.includes('{name}')) {
      return fail(TEST_NAME, `Message is missing {{name}} personalization placeholder`);
    }
    if (typeof d.tone !== 'string') {
      return fail(TEST_NAME, `Missing tone field`);
    }

    const source = d.fallback ? yellow('fallback') : green('Gemini');
    const preview = d.message.length > 60 ? d.message.slice(0, 60) + '…' : d.message;
    pass(TEST_NAME, `tone="${d.tone}" | message="${preview}" | source=${source}`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      fail(TEST_NAME, 'Connection refused — is the server running? (npm run dev)');
    } else {
      fail(TEST_NAME, err.response ? JSON.stringify(err.response.data) : err.message);
    }
  }
};

// TEST 3 — GET /api/ai/insights/:campaignId
// Fetches the most recent campaign from /api/campaigns, then calls insights.
// Expects: { success: true, data: { campaign: {...}, insights: { summary, recommendations } } }
const testInsights = async () => {
  const TEST_NAME = 'GET  /api/ai/insights/:campaignId';
  try {
    // Step 1: get a real campaignId from the DB
    const listRes = await axios.get(`${BASE_URL}/api/campaigns`, { timeout: 10000 });
    const campaigns = listRes.data?.data || [];

    // Find a completed campaign to analyze (insights require a launched campaign)
    const target = campaigns.find(c => c.status === 'completed') || campaigns[0];

    if (!target) {
      return fail(TEST_NAME, 'No campaigns found in DB — run a campaign first (POST /api/campaigns/:id/launch)');
    }

    // Step 2: call insights endpoint
    const { data, status } = await axios.get(
      `${BASE_URL}/api/ai/insights/${target._id}`,
      { timeout: 15000 }
    );

    if (status !== 200) {
      return fail(TEST_NAME, `Expected HTTP 200, got ${status}`);
    }
    if (!data.success) {
      return fail(TEST_NAME, `success field is false: ${JSON.stringify(data)}`);
    }

    const d = data.data;
    if (!d?.campaign || !d?.insights) {
      return fail(TEST_NAME, 'Response missing campaign or insights fields');
    }
    if (typeof d.insights.summary !== 'string') {
      return fail(TEST_NAME, 'insights.summary is not a string');
    }
    if (!Array.isArray(d.insights.recommendations)) {
      return fail(TEST_NAME, 'insights.recommendations is not an array');
    }

    const source = d.insights.fallback ? yellow('fallback') : green('Gemini');
    pass(TEST_NAME, `campaignId=${target._id} | recs=${d.insights.recommendations.length} | source=${source}`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      fail(TEST_NAME, 'Connection refused — is the server running? (npm run dev)');
    } else {
      fail(TEST_NAME, err.response ? JSON.stringify(err.response.data) : err.message);
    }
  }
};

// TEST 4 — Validate input errors are handled correctly (400, not 500)
const testValidation = async () => {
  const TEST_NAME = 'POST /api/ai/segment (missing goal → 400)';
  try {
    await axios.post(`${BASE_URL}/api/ai/segment`, {}, { timeout: 5000 });
    fail(TEST_NAME, 'Expected 400 error but got 200 — validation is not working');
  } catch (err) {
    if (err.response?.status === 400) {
      pass(TEST_NAME, `Correctly returned 400: "${err.response.data.message}"`);
    } else if (err.code === 'ECONNREFUSED') {
      fail(TEST_NAME, 'Connection refused — is the server running?');
    } else {
      fail(TEST_NAME, `Unexpected error: ${err.message}`);
    }
  }
};

// ─── Main runner ──────────────────────────────────────────────────────────────
const run = async () => {
  console.log('\n' + bold('═══════════════════════════════════════════'));
  console.log(bold('  Xeno CRM — Phase 5 AI Endpoint Tests'));
  console.log(bold('═══════════════════════════════════════════'));
  console.log(dim(`  Target: ${BASE_URL}`));
  console.log('');

  // Run tests sequentially so output is readable
  await testSegment();
  await testMessage();
  await testInsights();
  await testValidation();

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + bold('─── Summary ────────────────────────────────'));
  console.log(`  ${green(`${passed} passed`)}  ${failed > 0 ? red(`${failed} failed`) : dim('0 failed')}`);

  if (failed === 0) {
    console.log('\n' + green(bold('  ✓ All AI endpoint tests passed!')));
    console.log(dim('  Note: "fallback" means GEMINI_API_KEY is not set — endpoints still work.'));
    console.log(dim('  Set GEMINI_API_KEY in .env to enable live AI responses.\n'));
  } else {
    console.log('\n' + red(bold(`  ✗ ${failed} test(s) failed — see details above.\n`)));
    process.exit(1); // Non-zero exit so CI can catch failures
  }
};

run();
