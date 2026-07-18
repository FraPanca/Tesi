const commandService = require('../services/commandService');

// POST /api/commands
// Invia comando ON/OFF alla smart plug
const sendCommand = async (req, res) => {
    try {
        const { presa, command } = req.body;
        const result = await commandService.sendCommand(presa, command);
        res.status(200).json(result);
    } catch(err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { sendCommand }