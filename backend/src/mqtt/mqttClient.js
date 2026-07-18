const mqtt = require('mqtt');
const EnergyReading = require('../models/EnergyReading');

let client;


// Inizializza client MQTT e sottoscrive topic optimized da ESP32
const initMQTT = () => {
    client = mqtt.connect(process.env.MQTT_URI);

    client.on('connect', () => {
        console.log("MQTT connected successful");

        client.subscribe('home/+/optimized', (err) => {
            if(err)
                console.error("Subscribe Error: " + err);
        });

        client.on('message', async (topic, message) => {
            console.log(`Received MQTT message on ${topic}: ${message.toString()}`);

            try {
                const payload = JSON.parse(message.toString());
                const parts = topic.split('/');
                const presa = parts[1];

                await EnergyReading.create({
                    deviceId: payload.deviceId,
                    presa: presa,
                    power: payload.power,
                    voltage: payload.voltage,
                    current: payload.current
                });
            } catch(err) {
                console.error('MQTT processing error:', err);
            }
        });

        client.on('error', (err) => {
            console.error("MQTT Client Error: " + err);
        });
    });
};

// Pubblica comando ON/OFF sul topic /home/presaN/commands
const publishMQTT = (presa, message) => {
    if(client && client.connected) {
        const topic = `home/${presa}/commands`;
        client.publish(topic, message);
    } else {
        console.warn("Error: Impossible to publish on the topic: MQTT client not connected");
    }
};

module.exports = { initMQTT, publishMQTT };