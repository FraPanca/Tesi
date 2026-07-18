const Device = require('../models/Device');

// Restituisce tutti i dispositivi
exports.getDevices = async () => {
    return Device.find();
};

// Crea un nuovo dispositivo
exports.createDevice = async (data) => {
    return Device.create(data);
};