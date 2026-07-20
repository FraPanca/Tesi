const mongoose = require('mongoose');


async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/iot_energy';
  try {
    await mongoose.connect(uri);
    console.log('[MongoDB] connesso:', uri);
  } catch (err) {
    console.error('[MongoDB] errore di connessione:', err.message);
    process.exit(1);
  }
}


module.exports = { connectMongo };