// messageRoutes.js — Route for receiving dispatch requests from CRM backend.
//
// Base path /api/messages is registered in app.js.

const express = require('express');
const router = express.Router();
const { sendMessage } = require('../controllers/messageController');

// POST /api/messages/send — receive and process a message dispatch
router.post('/send', sendMessage);

module.exports = router;
