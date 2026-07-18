const { publishMQTT } = require('../mqtt/mqttClient');

// Invia comando ON/OFF a una smart plug tramite MQTT
exports.sendCommand = async (presa, command) => {
    if(!presa || !command)
        throw new Error('Presa e comando richiesti');
    
    publishMQTT(presa, command); // pubblica su home/presaN/commands
    return { presa, command, status: 'sent' };
};