const express = require('express');
const router = express.Router();
const commandController = require('../controllers/commandController');

// ---------------
//  Endpoint REST
// ---------------

// POST /api/commands
// Invia comando ON/OFF alla smart plug
router.post('/', commandController.sendCommand);

module.exports = router;