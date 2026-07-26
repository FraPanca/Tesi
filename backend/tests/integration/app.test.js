// authService.js e middleware/auth.js leggono queste variabili al momento del require(): vanno impostate PRIMA che qualsiasi require le carichi.
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.ADMIN_USERNAME = 'admin';

const bcrypt = require('bcryptjs');
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('password-corretta', 4);

// Mock di repository, modello Log, client MQTT. Il resto è codice reale: routes, controller, service, errorHandler, middleware auth.
jest.mock('../../src/repositories/presaRepository');
jest.mock('../../src/repositories/consumoRepository');
jest.mock('../../src/repositories/logRepository');
jest.mock('../../src/models/Log', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/mqtt/client', () => ({
  connettiMqtt: jest.fn(),
  inviaComando: jest.fn().mockResolvedValue(),
  registraDispositivo: jest.fn().mockResolvedValue(),
  rimuoviDispositivo: jest.fn().mockResolvedValue(),
  inviaComandoFlush: jest.fn().mockResolvedValue(),
  inviaComandoHealthcheck: jest.fn().mockResolvedValue(),
  mqttEvents: new (require('events').EventEmitter)(),
}));


const request = require('supertest');
const jwt = require('jsonwebtoken');
const presaRepository = require('../../src/repositories/presaRepository');
const logRepository = require('../../src/repositories/logRepository');
const { app } = require('../../src/app');


function tokenValido() {
  return jwt.sign({ sub: 'admin' }, process.env.JWT_SECRET);
}


describe('integrazione: routing + controller + service + errorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/prese risponde 200 con la lista dal service (percorso end-to-end felice)', async () => {
    presaRepository.findAll.mockResolvedValue([{ presaId: 'presa1', nome: 'Frigo' }]);

    const res = await request(app).get('/api/prese');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ presaId: 'presa1', nome: 'Frigo' }]);
  });

  test('GET /api/prese/:presaId risponde 404 se il service lancia ServiceError (nessun try/catch nel controller: verifica il forwarding automatico degli errori async di Express 5)', async () => {
    presaRepository.findByPresaId.mockResolvedValue(null);

    const res = await request(app).get('/api/prese/sconosciuta');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errore: 'Presa "sconosciuta" non trovata' });
  });

  test('POST /api/prese/:presaId/comando risponde 400 su azione non valida', async () => {
    const res = await request(app).post('/api/prese/presa1/comando').send({ azione: 'toggle' });

    expect(res.status).toBe(400);
    expect(res.body.errore).toMatch(/azione/);
  });

  test('POST /api/auth/login risponde 401 con credenziali errate', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'sbagliata' });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login risponde 200 con un token con credenziali corrette', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password-corretta' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('GET /api/logs senza token risponde 401 e il controller/service non viene mai raggiunto', async () => {
    const res = await request(app).get('/api/logs');

    expect(res.status).toBe(401);
    expect(logRepository.trova).not.toHaveBeenCalled();
  });

  test('GET /api/logs con token valido raggiunge il controller e risponde 200', async () => {
    logRepository.trova.mockResolvedValue([{ _id: '1', evento: 'auth.login' }]);

    const res = await request(app).get('/api/logs').set('Authorization', `Bearer ${tokenValido()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ _id: '1', evento: 'auth.login' }]);
  });

  test('POST /api/admin/flush senza token risponde 401 (non aspetta gli 8s della finestra di ascolto)', async () => {
    const res = await request(app).post('/api/admin/flush');

    expect(res.status).toBe(401);
  });

  test('un errore generico non gestito (senza .status) risponde 500', async () => {
    presaRepository.findAll.mockRejectedValue(new Error('Mongo esploso'));

    const res = await request(app).get('/api/prese');

    expect(res.status).toBe(500);
    expect(res.body.errore).toBe('Mongo esploso');
  });
});