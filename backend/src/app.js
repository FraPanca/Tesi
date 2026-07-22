require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');


const { connectMongo } = require('./config/db');
const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const { registraWebSocket } = require('./websocket');
const consumoService = require('./services/consumoService');
const comandoService = require('./services/comandoService');
const { connettiMqtt } = require('./mqtt/client');


const app = express();
app.use(express.json());

app.use('/api/prese', require('./routes/presaRoutes'));
app.use('/api/consumi', require('./routes/consumoRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
// TODO: montare qui il router previsioni quando sarà definito

// I controller (routes/*, controllers/*) non hanno try/catch espliciti sulle chiamate async: da Express 5 in poi una 
// promise rifiutata ritornata da un route handler viene inoltrata automaticamente a next(err) e arriva comunque qui 
// sotto. Con Express 4 sarebbe servito un wrapper esplicito tipo asyncHandler su ogni handler dei controller.
// L'error handler va montato per ultimo: solo così Express lo riconosce come destinazione degli errori.
app.use(errorHandler);


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const notificaWebSocket = registraWebSocket(io);
consumoService.impostaNotificaWebSocket(notificaWebSocket);
consumoService.impostaGestoreSoglia((presaId) => comandoService.inviaComando(presaId, 'off'));


async function start() {
  await connectMongo();
  await connectRedis();
  connettiMqtt();
 
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[Server] in ascolto sulla porta ${PORT}`);
  });
}

start();


module.exports = { app, io };