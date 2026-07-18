const deviceService = require('../services/deviceService');

// Restituisce lista dispositivi
const getDevices = async (req, res) => {
    try {
        const devices = await deviceService.getDevices();
        res.json(devices);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

// Crea dispositivo
const createDevice = async (req, res) => {
    try {
        const device = await deviceService.createDevice(req.body);
        res.status(201).json(device);
    } catch(err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { getDevices, createDevice }