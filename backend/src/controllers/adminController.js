const adminService = require('../services/adminService');


async function postFlush(req, res) {
  const dati = await adminService.richiediFlush();
  res.json({ dati });
}

async function postHealthcheck(req, res) {
  const risultato = await adminService.richiediHealthcheck();
  res.json(risultato);
}


module.exports = { postFlush, postHealthcheck };