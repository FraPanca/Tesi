function registraWebSocket(io) {
  io.on('connection', (socket) => {
    console.log('[WebSocket] client connesso:', socket.id);
    socket.on('subscribe', (presaId) => socket.join(`presa:${presaId}`));
  });

  // Funzione passata a ConsumoService.impostaNotificaWebSocket(): tiene il service disaccoppiato dai dettagli di socket.io.
  return function notifica(presaId, dato) {
    io.to(`presa:${presaId}`).emit('consumo:aggiornato', dato);
  };
}


module.exports = { registraWebSocket };