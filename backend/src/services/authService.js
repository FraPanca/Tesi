const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Log = require('../models/Log');

class ServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
  throw new Error('ADMIN_USERNAME / ADMIN_PASSWORD_HASH non definiti in .env');
}


async function login(username, password) {
  if (!username || !password) {
    throw new ServiceError('Username e password sono obbligatori', 400);
  }

  const usernameOk = username === ADMIN_USERNAME;
  const passwordOk = usernameOk && (await bcrypt.compare(password, ADMIN_PASSWORD_HASH));

  if (!passwordOk) {
    await Log.create({
      origine: 'sistema',
      livello: 'warn',
      evento: 'auth.login_fallito',
      messaggio: `Tentativo di login fallito per username "${username}"`,
    });
    throw new ServiceError('Credenziali non valide', 401);
  }

  await Log.create({
    origine: 'admin',
    evento: 'auth.login',
    messaggio: 'Login amministratore effettuato',
  });

  return jwt.sign({ sub: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}


module.exports = { ServiceError, login };