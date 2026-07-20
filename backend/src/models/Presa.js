const mongoose = require('mongoose');


const presaSchema = new mongoose.Schema(
  {
    presaId: { type: String, required: true, unique: true }, // Corrisponde al segmento "presaN" usato nei topic MQTT.
    nome: { type: String, required: true },
    ip: { type: String, required: true, unique: true }, // IP locale della presa fisica (Tapo P110).
    stato: { type: String, enum: ['on', 'off'], default: 'off' },
    sogliaPotenza: { type: Number, default: null }, // null = non impostata.
  },
  { timestamps: true }
);


module.exports = mongoose.model('Presa', presaSchema);