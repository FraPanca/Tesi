const Log = require('../models/Log');

const LIMITE_DEFAULT = 100;
const LIMITE_MASSIMO = 500; // tetto per evitare risposte enormi per chiamate senza filtri


async function trova({ evento, livello, origine, da, a, limite } = {}) {
  const filtro = {};
  if (evento) filtro.evento = evento;
  if (livello) filtro.livello = livello;
  if (origine) filtro.origine = origine;

  if (da || a) {
    filtro.timestamp = {};
    if (da) filtro.timestamp.$gte = da;
    if (a) filtro.timestamp.$lte = a;
  }

  const limiteEffettivo = Math.min(limite || LIMITE_DEFAULT, LIMITE_MASSIMO);

  return Log.find(filtro).sort({ timestamp: -1 }).limit(limiteEffettivo);
}


module.exports = { trova };