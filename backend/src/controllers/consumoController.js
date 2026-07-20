const consumoService = require('../services/consumoService');


async function getConsumiPresa(req, res) {
  const { da, a } = req.query;
  const consumi = await consumoService.consumiPresa(req.params.presaId, { da, a });
  res.json(consumi);
}

async function getUltimiValori(req, res) {
  const valori = await consumoService.ultimiValoriCache(req.params.presaId);
  res.json(valori);
}


module.exports = { getConsumiPresa, getUltimiValori };