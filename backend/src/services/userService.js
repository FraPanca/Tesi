const User = require('../models/User');

// Crea utente
const createUser = async (data) => {
    return User.create(data);
};

// Trova utente
const findUser = async (username) => {
    return User.findOne({ username });
};