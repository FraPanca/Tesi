const { createClient } = require('redis');


const redisClient = createClient({
    url: process.env.REDIS_URI
});

redisClient.on('error', (err) => {
    console.error("Redis client error: " + err);
});


// Connessione a Redis
const connectRedis = async () => {
    await redisClient.connect();
    console.log("Redis client connected");
};


module.exports = { redisClient, connectRedis }
