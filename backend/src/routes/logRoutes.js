const express = require('express');
const controller = require('../controllers/logController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/logs (NON protetto): usato da componenti esterni non autenticati (es. Prophet) per segnalare
// fallimenti di produzione (es. storico insufficiente per una presa) senza scrivere dati fittizi in Previsione.
router.post('/', controller.postLog);

router.use(verifyToken);

// GET /api/logs?evento=&livello=&origine=&da=&a=&limite=
router.get('/', controller.getLogs);


module.exports = router;