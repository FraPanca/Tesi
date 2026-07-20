const express = require('express');
const controller = require('../controllers/presaController');
const comandoController = require('../controllers/comandoController');

const router = express.Router();


// GET /api/prese  -> lista tutte le prese
router.get('/', controller.getPrese);

// GET /api/prese/:presaId  -> dettaglio di una presa
router.get('/:presaId', controller.getPresa);

// POST /api/prese  body: { "presaId", "nome", "ip", "sogliaPotenza"? }  -> crea una presa
// (pubblica anche la registrazione del dispositivo verso il gateway, vedi presaService)
router.post('/', controller.postPresa);

// PATCH /api/prese/:presaId  body: { "nome"?, "sogliaPotenza"? }  -> aggiorna nome/soglia
// ("stato" escluso di proposito, vedi presaService.aggiornaPresa)
router.patch('/:presaId', controller.patchPresa);

// DELETE /api/prese/:presaId  -> rimuove la presa (e la deregistra dal gateway)
router.delete('/:presaId', controller.deletePresa);

// POST /api/prese/:presaId/comando  body: { "azione": "on" | "off" }
router.post('/:presaId/comando', comandoController.postComando);


module.exports = router;