const mongoose = require('mongoose');

// schema utente sistema
const userSchema = new mongoose.Schema({

    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }

});

module.exports = mongoose.model('User', userSchema);