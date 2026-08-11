const express = require('express');
const controller = require('../controllers/previsioneController');

const router = express.Router();

// POST /api/previsioni/:presaId
// body: { orizzonte: { da, a }, valoriPrevisti: [{ ds, yhat, yhatLower?, yhatUpper? }], metriche? }
// Scritto esclusivamente dal servizio Prophet (nessun altro componente crea Previsioni).
router.post('/:presaId', controller.postPrevisione);

// GET /api/previsioni/:presaId/ultima  -> previsione più recente (per il frontend)
router.get('/:presaId/ultima', controller.getUltimaPrevisione);


module.exports = router;