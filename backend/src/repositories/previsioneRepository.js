const Previsione = require('../models/Previsione');


async function crea(dato) {
  return Previsione.create(dato);
}

async function trovaUltimaPerPresa(presaId) {
  return Previsione.findOne({ presaId }).sort({ generatoIl: -1 });
}


module.exports = { crea, trovaUltimaPerPresa };