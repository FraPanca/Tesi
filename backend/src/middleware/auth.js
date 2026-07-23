const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;


if (!JWT_SECRET) {
  throw new Error('JWT_SECRET non definito in .env');
}


// Unico livello di autorizzazione nel sistema: chi possiede un token valido è l'amministratore. 
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ errore: 'Token mancante' });
  }

  const token = authHeader.split(' ')[1];

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ errore: 'Token non valido o scaduto' });
  }
}


module.exports = { verifyToken };