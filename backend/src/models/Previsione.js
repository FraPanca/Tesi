const mongoose = require('mongoose');

// Sotto-documento: un singolo punto previsto (formato compatibile con l'output di Prophet)
const puntoPrevistoSchema = new mongoose.Schema(
  {
    ds: { type: Date, required: true },
    yhat: { type: Number, required: true },
    yhatLower: { type: Number },
    yhatUpper: { type: Number },
  },
  { _id: false }
);

// Sotto-documento: un singolo punto anomalo rilevato da Isolation Forest
const puntoAnomaloSchema = new mongoose.Schema(
  {
    ds: { type: Date, required: true },
    y: { type: Number, required: true },
    punteggio: { type: Number, required: true }, // convenzione Isolation Forest: più negativo = più anomalo
  },
  { _id: false }
);

const previsioneSchema = new mongoose.Schema({
  presaId: { type: String, required: true },
  generatoIl: { type: Date, default: Date.now },
  orizzonte: {
    da: { type: Date, required: true },
    a: { type: Date, required: true },
  },
  valoriPrevisti: [puntoPrevistoSchema],
  // Metriche di valutazione, popolate quando confrontiamo Prophet con la baseline. Assenti sulle scritture di
  // produzione giornaliere (solo la valutazione offline le popola).
  metriche: {
    mae: Number,
    rmse: Number,
    baselineConfronto: String,
  },
  // Suggerimenti di risparmio testuali (soglia utente + proiezione trend) e consumi anomali (Isolation Forest).
  // Entrambi opzionali: possono mancare se Prophet non ne genera per quella presa/finestra.
  suggerimenti: [String],
  anomalie: [puntoAnomaloSchema],
});


module.exports = mongoose.model('Previsione', previsioneSchema);