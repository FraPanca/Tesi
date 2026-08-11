const previsioneService = require('../services/previsioneService');


async function postPrevisione(req, res) {
  const previsione = await previsioneService.salvaPrevisione(req.params.presaId, req.body);
  res.status(201).json(previsione);
}

async function getUltimaPrevisione(req, res) {
  const previsione = await previsioneService.ultimaPrevisione(req.params.presaId);
  res.json(previsione);
}


module.exports = { postPrevisione, getUltimaPrevisione };