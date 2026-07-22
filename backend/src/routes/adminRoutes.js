const express = require('express');
const controller = require('../controllers/adminController');

const router = express.Router();

// POST /api/admin/flush
router.post('/flush', controller.postFlush);

// POST /api/admin/healthcheck
router.post('/healthcheck', controller.postHealthcheck);


module.exports = router;