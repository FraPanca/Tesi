const ConsumoOttimizzato = require('../models/ConsumoOttimizzato');
const { redisClient } = require('../config/redis');

const CACHE_MAX_VALORI = 20; // "N valori recenti" per presa (cache di ingestione, alimentata da MQTT)
const RANGE_CACHE_TTL_SECONDI = 30; // cache delle query storiche via API
// Bilancia velocità di risposta e freschezza. Un range "aperto" (es. senza "a" o con "a" >= adesso) potrebbe cambiare risultato 
// ad ogni nuovo dato in arrivo da MQTT; invece di tracciare quali chiavi in cache sono "aperte" per invalidarle puntualmente, si
// accetta un'incoerenza massima pari al TTL.


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

// --- Cache di ingestione ---

function chiaveRecenti(presaId) {
  return `consumi:${presaId}`;
}

async function aggiornaCache(presaId, dato) {
  const chiave = chiaveRecenti(presaId);
  await redisClient.lPush(chiave, JSON.stringify(dato));
  await redisClient.lTrim(chiave, 0, CACHE_MAX_VALORI - 1);
}

async function leggiCache(presaId) {
  const chiave = chiaveRecenti(presaId);
  const valori = await redisClient.lRange(chiave, 0, CACHE_MAX_VALORI - 1);
  return valori.map((v) => JSON.parse(v));
}

// --- Cache di interrogazione---

function chiaveRange(presaId, da, a) {
  const daChiave = da ? da.toISOString() : 'x';
  const aChiave = a ? a.toISOString() : 'x';
  return `consumi:range:${presaId}:${daChiave}:${aChiave}`;
}

async function leggiCacheRange(presaId, da, a) {
  const valore = await redisClient.get(chiaveRange(presaId, da, a));
  return valore ? JSON.parse(valore) : null;
}

async function scriviCacheRange(presaId, da, a, dati) {
  const chiave = chiaveRange(presaId, da, a);
  await redisClient.set(chiave, JSON.stringify(dati), { EX: RANGE_CACHE_TTL_SECONDI });
}

async function cancellaCache(presaId) {
  await redisClient.del(chiaveRecenti(presaId));

  const chiaviRange = await redisClient.keys(`consumi:range:${presaId}:*`);
  if (chiaviRange.length > 0) {
    await redisClient.del(chiaviRange);
  }
}


module.exports = {
  salva,
  trovaPerPresaERange,
  aggiornaCache,
  leggiCache,
  leggiCacheRange,
  scriviCacheRange,
  cancellaCache,
};