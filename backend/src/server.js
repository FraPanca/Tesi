require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const energyRoutes = require('./routes/energyRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const { connectMongo } = require('./db/mongo');
const { connectRedis } = require('./db/redis');
const { initMQTT } = require('./mqtt/mqttClient');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------
//  Middleware
// ------------

// Abilita richieste (CORS)
app.use(cors());

// Permette di interpretare JSON nel body delle richieste
app.use(express.json());

// Log delle richieste HTTP in console
app.use(morgan('dev'));


// --------
//  Routes
// --------
app.use('/api/energy', energyRoutes);
app.use('/api/commands', require('./routes/commandRoutes'));
app.use('/api/devices', deviceRoutes);


// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --------------------------------------------
//  Avvio server con try/catch per connessioni
// --------------------------------------------
const startServer = async () => {
  try {
    await connectMongo();
    await connectRedis();

    initMQTT();

    app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });

  } catch(err) {
    console.error('Errore avvio backend:', err);
    process.exit(1);
  }
};

startServer();