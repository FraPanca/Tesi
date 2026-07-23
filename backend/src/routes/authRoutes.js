const express = require('express');
const controller = require('../controllers/authController');

const router = express.Router();


// POST /api/auth/login
router.post('/login', controller.postLogin);


module.exports = router;