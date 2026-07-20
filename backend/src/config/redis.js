const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URI || 'redis://localhost:6379',
});


redisClient.on('error', (err) => {
  console.error('[Redis] errore:', err.message);
});

async function connectRedis() {
  await redisClient.connect();
  console.log('[Redis] connesso');
}


module.exports = { redisClient, connectRedis };