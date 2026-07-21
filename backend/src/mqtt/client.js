const mqtt = require('mqtt');
const consumoService = require('../services/consumoService');

let client;


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
    client.subscribe('home/+/optimized', { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] errore sottoscrizione:', err.message);
    });
  });
 
  client.on('message', async (topic, payload) => {
    try {
      const presaId = estraiPresaId(topic);
      const grezzo = JSON.parse(payload.toString());
      const dato = mappaDatoOttimizzato(grezzo);
      await consumoService.salvaDatoOttimizzato({ presaId, ...dato });
    } catch (err) {
      console.error('[MQTT] errore elaborazione messaggio:', err.message);
    }
  });
 
  client.on('error', (err) => console.error('[MQTT] errore connessione:', err.message));
 
  return client;
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


module.exports = { connettiMqtt, inviaComando, registraDispositivo, rimuoviDispositivo };