const logService = require('../services/logService');


async function getLogs(req, res) {
  const { evento, livello, origine, da, a, limite } = req.query;
  const log = await logService.cercaLog({ evento, livello, origine, da, a, limite });
  res.json(log);
}


module.exports = { getLogs };