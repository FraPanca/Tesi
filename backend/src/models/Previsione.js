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

const previsioneSchema = new mongoose.Schema({
  presaId: { type: String, required: true },
  generatoIl: { type: Date, default: Date.now },
  orizzonte: {
    da: { type: Date, required: true },
    a: { type: Date, required: true },
  },
  valoriPrevisti: [puntoPrevistoSchema],
  // Metriche di valutazione, popolate quando confrontiamo Prophet con la baseline
  metriche: {
    mae: Number,
    rmse: Number,
    baselineConfronto: String,
  },
});


module.exports = mongoose.model('Previsione', previsioneSchema);