// messageRoutes.js — Routes for channel-service message dispatch.
//
// PHASE 4: Route path changed to /channel/send to match spec.
// Registered in app.js as: app.use('/', messageRoutes)
// So the full path becomes: POST /channel/send

const express = require('express');
const router = express.Router();
const { sendMessage } = require('../controllers/messageController');

// POST /channel/send — receive dispatch request from CRM backend
// Returns 202 Accepted immediately. Delivery happens asynchronously.
router.post('/channel/send', sendMessage);

module.exports = router;
