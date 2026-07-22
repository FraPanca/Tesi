const { inviaComandoFlush, inviaComandoHealthcheck, mqttEvents } = require('../mqtt/client');

const ATTESA_FLUSH_MS = 8000;       // finestra di ascolto dei dati "optimized" dopo il comando di flush
const ATTESA_HEALTHCHECK_MS = 5000; // finestra di ascolto delle risposte di healthcheck

// Componenti da cui ci si aspetta una risposta ad un comando di healthcheck. Chi non risponde entro ATTESA_HEALTHCHECK_MS viene riportato come "Errore".
const COMPONENTI_ATTESI = ['gateway', 'esp32_load_balancer', 'esp32_worker1', 'esp32_worker2'];


// Pubblica il comando di flush e restituisce la lista dei dati "optimized" arrivati nella finestra di ascolto successiva.
async function richiediFlush() {
  const datiRicevuti = [];

  return new Promise((resolve) => {
    function onDato(dato) {
      datiRicevuti.push(dato);
    }

    mqttEvents.on('datoOttimizzato', onDato);
    inviaComandoFlush();

    setTimeout(() => {
      mqttEvents.off('datoOttimizzato', onDato);
      resolve(datiRicevuti);
    }, ATTESA_FLUSH_MS);
  });
}

// Pubblica il comando di healthcheck e restituisce { componente: "OK" | "Errore" } per ciascun componente.
async function richiediHealthcheck() {
  const risposte = new Map(); // componente -> stato riportato dal componente stesso

  return new Promise((resolve) => {
    function onRisposta({ componente, stato }) {
      risposte.set(componente, stato);
    }

    mqttEvents.on('healthcheckResponse', onRisposta);
    inviaComandoHealthcheck();

    setTimeout(() => {
      mqttEvents.off('healthcheckResponse', onRisposta);

      const risultato = {};
      for (const componente of COMPONENTI_ATTESI) {
        const stato = risposte.get(componente);
        risultato[componente] = stato && stato.toLowerCase() === 'ok' ? 'OK' : 'Errore';
      }
      resolve(risultato);
    }, ATTESA_HEALTHCHECK_MS);
  });
}


module.exports = { richiediFlush, richiediHealthcheck };