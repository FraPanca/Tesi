const mqtt = require('mqtt');
const EventEmitter = require('events');
const consumoService = require('../services/consumoService');

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
      await consumoService.salvaDatoOttimizzato({ presaId, ...dato });

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

// Pubblica un comando on/off.
function inviaComando(presaId, ip, azione) {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  const topic = `home/${presaId}/commands`;
  client.publish(topic, JSON.stringify({ action: azione, ip }));
}

// Registra un dispositivo presso il gateway (gateway/src/registry/device_registry.py).
function registraDispositivo(ip, presaId) {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  client.publish('home/system/commands', JSON.stringify({ action: 'add', ip, id: presaId }));
}

// Rimuove un dispositivo presso il gateway (gateway/src/registry/device_registry.py).
function rimuoviDispositivo(ip) {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  client.publish('home/system/commands', JSON.stringify({ action: 'remove', ip }));
}

// Comanda agli ESP32 elaboratori l'invio immediato dei dati aggregati correnti, indipendentemente dalla finestra di aggregazione in corso.
function inviaComandoFlush() {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  client.publish(TOPIC_FLUSH_COMANDO, JSON.stringify({}));
}

// Comanda un healthcheck a gateway ed ESP32.
function inviaComandoHealthcheck() {
  if (!client) throw new Error('Client MQTT non ancora connesso');
  client.publish(TOPIC_HEALTHCHECK_COMANDO, JSON.stringify({}));
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