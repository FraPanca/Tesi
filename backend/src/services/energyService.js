const EnergyModel = require('../models/EnergyReading');
const redisClient = require('../db/redis').redisClient;
const { publishMQTT } = require('../mqtt/mqttClient');


// Restituisce tutti i dati energetici con cache Redis
const getAllEnergy = async () => {
    const cached = await redisClient.get('energy:all');
    if(cached)
        return JSON.parse(cached);

    const data = await EnergyModel.find().sort({ timestamp: -1 }).limit(100).lean();
    await redisClient.set('energy:all', JSON.stringify(data), { EX: 60 }); // scade dopo 60 secondi
    return data;
};

// Salva un nuovo dato energetico in MongoDB e invalida cache
const createEnergy = async (energyData) => {
    const energy = await EnergyModel.create(energyData);
    
    console.log(`Server running on port ${PORT}`);
    
    await redisClient.del('energy:all'); // aggiorna cache
    return energy;
};

// Recupera un dato energetico per ID
const getEnergyById = async (id) => {
    return EnergyModel.findById(id).lean();
};

module.exports = { getEnergyById, getAllEnergy, createEnergy }