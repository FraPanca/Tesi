const presaRepository = require('../repositories/presaRepository');
const consumoService = require('./consumoService');
const mqttClient = require('../mqtt/client');

class ServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}


async function listaPrese() {
  return presaRepository.findAll();
}

async function dettaglioPresa(presaId) {
  const presa = await presaRepository.findByPresaId(presaId);
  if (!presa) throw new ServiceError(`Presa "${presaId}" non trovata`, 404);
  return presa;
}

async function creaPresa({ presaId, nome, ip, sogliaPotenza }) {
  if (!presaId || !nome || !ip) {
    throw new ServiceError('presaId, nome e ip sono obbligatori', 400);
  }

  const esistentePerId = await presaRepository.findByPresaId(presaId);
  if (esistentePerId) {
    throw new ServiceError(`Presa "${presaId}" già registrata`, 409);
  }

  const esistentePerIp = await presaRepository.findByIp(ip);
  if (esistentePerIp) {
    throw new ServiceError(`IP "${ip}" già usato dalla presa "${esistentePerIp.presaId}"`, 409);
  }

  const presa = await presaRepository.create({ presaId, nome, ip, sogliaPotenza });

  // Senza questo, la presa esisterebbe solo in MongoDB: il gateway legge i dispositivi da monitorare da
  // devices.json, popolato solo tramite questo comando "system" (gateway/src/registry/device_registry.py).
  mqttClient.registraDispositivo(ip, presaId);

  return presa;
}

async function aggiornaPresa(presaId, updates) {
  // "stato" è escluso di proposito: l'accensione/spegnimento passa dal ComandoService (topic MQTT commands), non da una
  // PATCH diretta sul dato persistito — altrimenti il dato in Mongo potrebbe disallinearsi dallo stato reale della presa fisica.
  const CAMPI_MODIFICABILI = ['nome', 'sogliaPotenza'];
  const payload = {};
  for (const campo of CAMPI_MODIFICABILI) {
    if (updates[campo] !== undefined) payload[campo] = updates[campo];
  }

  if (Object.keys(payload).length === 0) {
    throw new ServiceError('Nessun campo valido da aggiornare', 400);
  }

  const aggiornata = await presaRepository.updateByPresaId(presaId, payload);
  if (!aggiornata) throw new ServiceError(`Presa "${presaId}" non trovata`, 404);
  return aggiornata;
}

async function rimuoviPresa(presaId) {
  const rimossa = await presaRepository.deleteByPresaId(presaId);
  if (!rimossa) throw new ServiceError(`Presa "${presaId}" non trovata`, 404);

  mqttClient.rimuoviDispositivo(rimossa.ip);

  // Senza questo la chiave "recenti" e le eventuali chiavi "range" di questa presa restano in
  // Redis come dati orfani: nessun dato futuro arriverà mai più con questo presaId a sovrascriverle.
  await consumoService.cancellaCachePresa(presaId);

  return rimossa;
}


module.exports = {
  ServiceError,
  listaPrese,
  dettaglioPresa,
  creaPresa,
  aggiornaPresa,
  rimuoviPresa,
};