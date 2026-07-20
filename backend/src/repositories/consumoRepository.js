const ConsumoOttimizzato = require('../models/ConsumoOttimizzato');
const { redisClient } = require('../config/redis');

const CACHE_MAX_VALORI = 20; // "N valori recenti" per presa


async function salva(dato) {
  return ConsumoOttimizzato.create(dato);
}

async function trovaPerPresaERange(presaId, da, a) {
  const filtro = { presaId };
  if (da || a) {
    filtro.timestamp = {};
    if (da) filtro.timestamp.$gte = da;
    if (a) filtro.timestamp.$lte = a;
  }
  return ConsumoOttimizzato.find(filtro).sort({ timestamp: 1 });
}

async function aggiornaCache(presaId, dato) {
  const chiave = `consumi:${presaId}`;
  await redisClient.lPush(chiave, JSON.stringify(dato));
  await redisClient.lTrim(chiave, 0, CACHE_MAX_VALORI - 1);
}

async function leggiCache(presaId) {
  const chiave = `consumi:${presaId}`;
  const valori = await redisClient.lRange(chiave, 0, CACHE_MAX_VALORI - 1);
  return valori.map((v) => JSON.parse(v));
}


module.exports = { salva, trovaPerPresaERange, aggiornaCache, leggiCache };