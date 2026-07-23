const express = require('express');
const controller = require('../controllers/logController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

// GET /api/logs?evento=&livello=&origine=&da=&a=&limite=
router.get('/', controller.getLogs);


module.exports = router;