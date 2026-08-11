const logService = require('../services/logService');


async function getLogs(req, res) {
  const { evento, livello, origine, da, a, limite } = req.query;
  const log = await logService.cercaLog({ evento, livello, origine, da, a, limite });
  res.json(log);
}

async function postLog(req, res) {
  const { livello, evento, messaggio, metadati } = req.body;
  const log = await logService.creaLog({ origine: 'sistema', livello, evento, messaggio, metadati });
  res.status(201).json(log);
}


module.exports = { getLogs, postLog };