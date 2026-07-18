const mongoose = require('mongoose');

// Schema metadati dispositivo (presa smart)
const deviceSchema = new mongoose.Schema({

    presa: { type: String, required: true, unique: true },
    nome: { type: String },
    location: { type: String }

}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);