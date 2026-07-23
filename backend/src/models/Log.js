const mongoose = require('mongoose');


const TTL_SECONDI = 60 * 60 * 24 * 30; // 30 giorni: MongoDB cancella da solo i documenti scaduti (indice TTL sotto)

const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  // Chi ha generato l'evento: l'amministratore (azione manuale, es. login, flush) oppure il sistema stesso.
  origine: { type: String, enum: ['admin', 'sistema'], required: true },
  livello: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
  evento: { type: String, required: true }, // es. 'auth.login', 'mqtt.retry_esaurito'
  messaggio: { type: String, required: true },
  metadati: { type: mongoose.Schema.Types.Mixed, default: {} },
});

logSchema.index({ timestamp: 1 }, { expireAfterSeconds: TTL_SECONDI });
logSchema.index({ evento: 1 });
logSchema.index({ livello: 1 });


module.exports = mongoose.model('Log', logSchema);