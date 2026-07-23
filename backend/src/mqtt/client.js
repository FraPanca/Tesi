const mqtt = require('mqtt');
const EventEmitter = require('events');
const consumoService = require('../services/consumoService');
const { retryConBackoff } = require('../utils/retry');
const Log = require('../models/Log');

let client;

// Emette eventi per i flussi MQTT che servono anche a chi non è il consumer principale del dato.
const mqttEvents = new EventEmitter();

const TOPIC_OPTIMIZED = 'home/+/optimized';
const TOPIC_FLUSH_COMANDO = 'home/system/flush';
const TOPIC_HEALTHCHECK_COMANDO = 'home/system/healthcheck';
const TOPIC_HEALTHCHECK_RISPOSTA = 'home/system/healthcheck/response';


function connettiMqtt() {
  const url = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  client = mqtt.connect(url, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
    // clientId stabile + clean:false = sessione persistente: il broker ricorda la subscription e
    // mette in coda i messaggi QoS>=1 arrivati mentre il backend è disconnesso invece di scartarli.
    clientId: 'backend-iot-energy',
    clean: false,
  });

  client.on('connect', () => {
    console.log('[MQTT] connesso al broker:', url);
    client.subscribe(TOPIC_OPTIMIZED, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] errore sottoscrizione optimized:', err.message);
    });

    // QoS 0
    client.subscribe(TOPIC_HEALTHCHECK_RISPOSTA, { qos: 0 }, (err) => {
      if (err) console.error('[MQTT] errore sottoscrizione healthcheck response:', err.message);
    });
  });

  client.on('message', async (topic, payload) => {
    try {
      if (topic === TOPIC_HEALTHCHECK_RISPOSTA) {
        gestisciRispostaHealthcheck(payload);
        return;
      }

      const presaId = estraiPresaId(topic);
      const grezzo = JSON.parse(payload.toString());
      const dato = mappaDatoOttimizzato(grezzo);
      
      try {
        await retryConBackoff(() => consumoService.salvaDatoOttimizzato({ presaId, ...dato }));
      } catch (err) {
        console.error(`[MQTT] salvataggio dato optimized fallito dopo i retry (${presaId}):`, err.message);
        await Log.create({
          origine: 'sistema',
          livello: 'error',
          evento: 'mqtt.retry_esaurito',
          messaggio: `Salvataggio dato optimized fallito dopo i retry su ${presaId}`,
          metadati: { presaId },
        }).catch(() => {});
      }

      mqttEvents.emit('datoOttimizzato', { presaId, ...dato });
    } catch (err) {
      console.error('[MQTT] errore elaborazione messaggio:', err.message);
    }
  });

  client.on('error', (err) => console.error('[MQTT] errore connessione:', err.message));

  return client;
}

function gestisciRispostaHealthcheck(payload) {
  try {
    const { componente, stato } = JSON.parse(payload.toString());
    mqttEvents.emit('healthcheckResponse', { componente, stato });
  } catch (err) {
    console.error('[MQTT] risposta healthcheck non valida:', err.message);
  }
}

function estraiPresaId(topic) {
  // "home/presa1/optimized" -> "presa1"
  return topic.split('/')[1];
}

// Adatta il payload pubblicato dal firmware ESP32 al modello dati interno del backend.
function mappaDatoOttimizzato(payloadEsp32) {
  return {
    potenza: payloadEsp32.power_w,
    tensione: payloadEsp32.voltage_v,
    corrente: payloadEsp32.current_a,
    // Il worker aggrega su una finestra [timestamp_start, timestamp_end] (epoch seconds, float):
    // viene usata la fine come istante rappresentativo del valore aggregato.
    timestamp: new Date(payloadEsp32.timestamp_end * 1000),
  };
}


function pubblicaAsync(topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, (err) => (err ? reject(err) : resolve()));
  });
}
 
// Wrapper comune a tutte le pubblicazioni verso gateway/ESP32: retry con backoff.
async function pubblicaConRetry(topic, payload, { messaggio, metadati } = {}) {
  try {
    await retryConBackoff(() => pubblicaAsync(topic, payload));
  } catch (err) {
    console.error(`[MQTT] pubblicazione fallita dopo i retry su ${topic}:`, err.message);
    await Log.create({
      origine: 'sistema',
      livello: 'error',
      evento: 'mqtt.retry_esaurito',
      messaggio: messaggio || `Pubblicazione fallita dopo i retry su ${topic}`,
      metadati: metadati || {},
    }).catch(() => {});
    throw err;
  }
}
 
// Pubblica un comando on/off.
async function inviaComando(presaId, ip, azione) {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  const topic = `home/${presaId}/commands`;
  await pubblicaConRetry(topic, JSON.stringify({ action: azione, ip }), {
    messaggio: `Pubblicazione comando fallita dopo i retry su ${topic}`,
    metadati: { presaId, azione },
  });
}
 
// Registra un dispositivo presso il gateway (gateway/src/registry/device_registry.py).
async function registraDispositivo(ip, presaId) {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  await pubblicaConRetry('home/system/commands', JSON.stringify({ action: 'add', ip, id: presaId }), {
    messaggio: `Registrazione dispositivo fallita dopo i retry (${presaId})`,
    metadati: { presaId, ip },
  });
}
 
// Rimuove un dispositivo presso il gateway (gateway/src/registry/device_registry.py).
async function rimuoviDispositivo(ip) {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  await pubblicaConRetry('home/system/commands', JSON.stringify({ action: 'remove', ip }), {
    messaggio: `Deregistrazione dispositivo fallita dopo i retry (${ip})`,
    metadati: { ip },
  });
}
 
// Comanda agli ESP32 elaboratori l'invio immediato dei dati aggregati correnti, indipendentemente dalla finestra di aggregazione in corso.
async function inviaComandoFlush() {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  await pubblicaConRetry(TOPIC_FLUSH_COMANDO, JSON.stringify({}), {
    messaggio: 'Comando di flush fallito dopo i retry',
  });
}
 
// Comanda un healthcheck a gateway ed ESP32..
async function inviaComandoHealthcheck() {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  await pubblicaConRetry(TOPIC_HEALTHCHECK_COMANDO, JSON.stringify({}), {
    messaggio: 'Comando di healthcheck fallito dopo i retry',
  });
}
 
 
module.exports = {
  connettiMqtt,
  inviaComando,
  registraDispositivo,
  rimuoviDispositivo,
  inviaComandoFlush,
  inviaComandoHealthcheck,
  mqttEvents,
};