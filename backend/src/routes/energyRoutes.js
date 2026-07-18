const express = require('express');
const router = express.Router();
const energyController = require('../controllers/energyController');

// ---------------
//  Endpoint REST
// ---------------

// GET /api/energy
// Recupera tutti i dati energetici
router.get('/', energyController.getAllEnergy);

// POST /api/energy
// Salva un nuovo dato energetico
router.post('/', energyController.createEnergy);

// GET /api/energy/:id
// Recupera un dato energetico per id
router.get('/:id', energyController.getEnergyById);

module.exports = router;