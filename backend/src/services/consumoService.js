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
  // soglia perché potrebbero arrivarne molte prima che la presa fisica reagisca
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

  return consumoRepository.trovaPerPresaERange(
    presaId,
    da ? new Date(da) : undefined,
    a ? new Date(a) : undefined
  );
}

async function ultimiValoriCache(presaId) {
  return consumoRepository.leggiCache(presaId);
}


module.exports = {
  ServiceError,
  impostaNotificaWebSocket,
  impostaGestoreSoglia,
  salvaDatoOttimizzato,
  consumiPresa,
  ultimiValoriCache,
};