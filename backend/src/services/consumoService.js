const consumoRepository = require('../repositories/consumoRepository');
const presaRepository = require('../repositories/presaRepository');

class ServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}


let notificaWebSocket = () => {};
function impostaNotificaWebSocket(fn) {
  notificaWebSocket = fn;
}

let inviaComandoSpegnimento = async () => {};
function impostaGestoreSoglia(fn) {
  inviaComandoSpegnimento = fn;
}

async function salvaDatoOttimizzato({ presaId, timestamp, potenza, tensione, corrente }) {
  const dato = {
    presaId,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    potenza,
    tensione,
    corrente,
  };

  await consumoRepository.salva(dato);
  await consumoRepository.aggiornaCache(presaId, dato);
  notificaWebSocket(presaId, dato);
  await verificaSogliaPotenza(presaId, potenza);

  return dato;
}

async function verificaSogliaPotenza(presaId, potenza) {
  const presa = await presaRepository.findByPresaId(presaId);
  if (!presa || presa.sogliaPotenza == null) return;

  // Il controllo su presa.stato evita di rimandare il comando off ad ogni singola lettura sopra
  // soglia perché potrebbero arrivarne molte prima che la presa fisica reagisca.
  if (potenza > presa.sogliaPotenza && presa.stato !== 'off') {
    console.log(
      `[ConsumoService] soglia superata su ${presaId}: ${potenza}W > ${presa.sogliaPotenza}W, invio comando off`
    );
    await inviaComandoSpegnimento(presaId);
  }
}

async function consumiPresa(presaId, { da, a } = {}) {
  const presa = await presaRepository.findByPresaId(presaId);
  if (!presa) throw new ServiceError(`Presa "${presaId}" non trovata`, 404);

  const daDate = da ? new Date(da) : undefined;
  const aDate = a ? new Date(a) : undefined;

  // Cache di interrogazione: se la stessa combinazione (presaId, da, a) è già stata richiesta di recente, evita di rifare la query su MongoDB.
  const risultatoCache = await consumoRepository.leggiCacheRange(presaId, daDate, aDate);
  if (risultatoCache) return risultatoCache;

  const risultato = await consumoRepository.trovaPerPresaERange(presaId, daDate, aDate);
  await consumoRepository.scriviCacheRange(presaId, daDate, aDate, risultato);
  return risultato;
}

async function ultimiValoriCache(presaId) {
  return consumoRepository.leggiCache(presaId);
}

async function cancellaCachePresa(presaId) {
  await consumoRepository.cancellaCache(presaId);
}


module.exports = {
  ServiceError,
  impostaNotificaWebSocket,
  impostaGestoreSoglia,
  salvaDatoOttimizzato,
  consumiPresa,
  ultimiValoriCache,
  cancellaCachePresa,
};