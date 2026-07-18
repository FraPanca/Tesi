const energyService = require('../services/energyService');

// Recupera tutti i dati energetici
const getAllEnergy = async (req, res) => {
  try {
    const data = await energyService.getAllEnergy();
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

// Salva un nuovo dato energetico
const createEnergy = async (req, res) => {
  try {
    const energy = await energyService.createEnergy(req.body);
    res.status(201).json(energy);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

// Recupera un dato energetico per id
const getEnergyById = async (req, res) => {
  try {
    const energy = await energyService.getEnergyById(req.params.id);
    if(!energy)
      return res.status(404).json({ error: 'Not found' });
    
    res.json(energy);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getEnergyById, getAllEnergy, createEnergy}