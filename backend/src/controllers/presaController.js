const presaService = require('../services/presaService');


async function getPrese(req, res) {
  const prese = await presaService.listaPrese();
  res.json(prese);
}

async function getPresa(req, res) {
  const presa = await presaService.dettaglioPresa(req.params.presaId);
  res.json(presa);
}

async function postPresa(req, res) {
  const presa = await presaService.creaPresa(req.body);
  res.status(201).json(presa);
}

async function patchPresa(req, res) {
  const presa = await presaService.aggiornaPresa(req.params.presaId, req.body);
  res.json(presa);
}

async function deletePresa(req, res) {
  await presaService.rimuoviPresa(req.params.presaId);
  res.status(204).send();
}


module.exports = { getPrese, getPresa, postPresa, patchPresa, deletePresa };