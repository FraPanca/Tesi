const mongoose = require('mongoose');

// Schema letture energetiche delle prese
const energyReadingSchema = new mongoose.Schema({

    deviceId: { type: String, required: true },
    presa: { type: String, required: true },
    power: { type: Number, required: true },
    voltage: { type: Number, required: true },
    current: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }

});

// Indice per query veloci su presa e timestamp
energyReadingSchema.index({ presa: 1, timestamp: -1 });
energyReadingSchema.index({ timestamp: -1 });

module.exports = mongoose.model('EnergyReading', energyReadingSchema);