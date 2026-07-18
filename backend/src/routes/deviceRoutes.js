const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

// ---------------
//  Endpoint REST
// ---------------

// GET /api/devices
// Restituisce lista dispositivi
router.get('/', deviceController.getDevices);

// POST /api/devices
// Crea dispositivo
router.post('/', deviceController.createDevice);

module.exports = router;