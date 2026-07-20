const mqttClient = require('../mqtt/client');
const presaRepository = require('../repositories/presaRepository');


class ServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function inviaComando(presaId, azione) {
  if (!['on', 'off'].includes(azione)) {
    throw new ServiceError('azione deve essere "on" oppure "off"', 400);
  }

  const presa = await presaRepository.findByPresaId(presaId);
  if (!presa) throw new ServiceError(`Presa "${presaId}" non trovata`, 404);

  // Viene pubblicato il comando ma non aggiorna subito "stato" su Presa, perché lo stato effettivo
  // verrà confermato quando arriverà il prossimo dato ottimizzato dalla presa reale.
  mqttClient.inviaComando(presaId, presa.ip, azione);

  // Aggiornamento ottimistico: si ha certezza che il comando è stato pubblicato sul broker,
  // non che la presa fisica l'abbia eseguito (MQTT QoS 0, nessun ack end-to-end nel gateway).
  await presaRepository.updateByPresaId(presaId, { stato: azione });
}


module.exports = { ServiceError, inviaComando };