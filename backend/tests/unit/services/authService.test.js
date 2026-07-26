// authService.js legge queste variabili al momento del require() e lancia un'eccezione se mancano: vanno impostate PRIMA di richiedere il modulo.
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.ADMIN_USERNAME = 'admin';

const bcrypt = require('bcryptjs');
// Cost basso (4 invece del default 10): l'hash serve solo a testare il confronto, non la sicurezza reale.
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('password-corretta', 4);

jest.mock('../../../src/models/Log', () => ({ create: jest.fn().mockResolvedValue({}) }));

const jwt = require('jsonwebtoken');
const Log = require('../../../src/models/Log');
const authService = require('../../../src/services/authService');


describe('authService.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ritorna un JWT valido (sub: "admin") con credenziali corrette', async () => {
    const token = await authService.login('admin', 'password-corretta');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.sub).toBe('admin');
  });

  test('registra un log "auth.login" (origine admin) su login riuscito', async () => {
    await authService.login('admin', 'password-corretta');

    expect(Log.create).toHaveBeenCalledWith(
      expect.objectContaining({ origine: 'admin', evento: 'auth.login' })
    );
  });

  test('rifiuta con ServiceError 401 se lo username non corrisponde', async () => {
    await expect(authService.login('utente-sbagliato', 'password-corretta')).rejects.toMatchObject({
      status: 401,
    });
  });

  test('rifiuta con ServiceError 401 se la password è sbagliata', async () => {
    await expect(authService.login('admin', 'password-sbagliata')).rejects.toMatchObject({
      status: 401,
    });
  });

  test('registra un log "auth.login_fallito" (livello warn) su credenziali errate', async () => {
    await expect(authService.login('admin', 'password-sbagliata')).rejects.toThrow();

    expect(Log.create).toHaveBeenCalledWith(
      expect.objectContaining({ evento: 'auth.login_fallito', livello: 'warn' })
    );
  });

  test('rifiuta con ServiceError 400 se username o password mancano', async () => {
    await expect(authService.login('', 'password-corretta')).rejects.toMatchObject({ status: 400 });
    await expect(authService.login('admin', '')).rejects.toMatchObject({ status: 400 });
    await expect(authService.login(undefined, undefined)).rejects.toMatchObject({ status: 400 });
  });
});