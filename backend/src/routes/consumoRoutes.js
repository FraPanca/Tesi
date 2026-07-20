const express = require('express');
const controller = require('../controllers/consumoController');

const router = express.Router();


// GET /api/consumi/:presaId?da=2026-07-01&a=2026-07-20
router.get('/:presaId', controller.getConsumiPresa);

// GET /api/consumi/:presaId/recenti  (ultimi N valori, da cache Redis)
router.get('/:presaId/recenti', controller.getUltimiValori);


module.exports = router;