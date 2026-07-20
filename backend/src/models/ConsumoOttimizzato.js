const mongoose = require('mongoose');


const consumoSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    presaId: { type: String, required: true },
    potenza: { type: Number, required: true }, // W
    tensione: { type: Number, required: true }, // V
    corrente: { type: Number, required: true }, // A
  },
  {
    timeseries: {
      timeField: 'timestamp',
      metaField: 'presaId',
      granularity: 'seconds',
    },
  }
);


module.exports = mongoose.model(
  'ConsumoOttimizzato',
  consumoSchema,
  'consumi_ottimizzati'
);