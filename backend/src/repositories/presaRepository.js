const Presa = require('../models/Presa');


async function findAll() {
  return Presa.find().sort({ createdAt: 1 });
}

async function findByPresaId(presaId) {
  return Presa.findOne({ presaId });
}

async function create(data) {
  return Presa.create(data);
}

async function updateByPresaId(presaId, updates) {
  return Presa.findOneAndUpdate({ presaId }, updates, {
    new: true, // ritorna il documento aggiornato
    runValidators: true, // riapplica le validazioni dello schema anche in update
  });
}

async function deleteByPresaId(presaId) {
  return Presa.findOneAndDelete({ presaId });
}


module.exports = { findAll, findByPresaId, create, updateByPresaId, deleteByPresaId };