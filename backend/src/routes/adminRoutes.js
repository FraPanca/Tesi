const express = require('express');
const controller = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

// POST /api/admin/flush
router.post('/flush', controller.postFlush);

// POST /api/admin/healthcheck
router.post('/healthcheck', controller.postHealthcheck);


module.exports = router;