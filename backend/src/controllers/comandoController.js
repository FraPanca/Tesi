const comandoService = require('../services/comandoService');


async function postComando(req, res) {
  const { azione } = req.body;
  await comandoService.inviaComando(req.params.presaId, azione);
  res.status(202).json({ messaggio: 'Comando inviato' });
}


module.exports = { postComando };