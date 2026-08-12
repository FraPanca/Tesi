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
jest.mock('../../src/repositories/previsioneRepository');
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
const previsioneRepository = require('../../src/repositories/previsioneRepository');
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

  describe('POST /api/previsioni/:presaId (nessun verifyToken)', () => {
    const bodyMinimo = {
      orizzonte: { da: '2026-08-11T00:00:00Z', a: '2026-08-17T23:00:00Z' },
      valoriPrevisti: [{ ds: '2026-08-11T00:00:00Z', yhat: 45.2 }],
    };

    test('risponde 201 SENZA header Authorization (route pubblica, scritta dal servizio Prophet)', async () => {
      previsioneRepository.crea.mockResolvedValue({ _id: '1', presaId: 'presa1', ...bodyMinimo });

      const res = await request(app).post('/api/previsioni/presa1').send(bodyMinimo);

      expect(res.status).toBe(201);
    });

    test('risponde 201 anche CON "metriche" nel body (valutazione offline)', async () => {
      const metriche = { mae: 12.4, rmse: 18.9, baselineConfronto: 'media mobile 7gg' };
      previsioneRepository.crea.mockResolvedValue({ _id: '1' });

      const res = await request(app)
        .post('/api/previsioni/presa1')
        .send({ ...bodyMinimo, metriche });

      expect(res.status).toBe(201);
      expect(previsioneRepository.crea).toHaveBeenCalledWith(expect.objectContaining({ metriche }));
    });

    test('un ds ambiguo (naive) risponde 400 nello stesso formato {"errore": "..."} degli altri 400', async () => {
      const res = await request(app)
        .post('/api/previsioni/presa1')
        .send({ ...bodyMinimo, valoriPrevisti: [{ ds: '2026-08-11T14:00:00', yhat: 1 }] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ errore: expect.stringContaining('valoriPrevisti[0].ds') });
      expect(previsioneRepository.crea).not.toHaveBeenCalled();
    });

    test('un presaId nel body viene ignorato: viene salvato quello del path', async () => {
      previsioneRepository.crea.mockResolvedValue({ _id: '1' });

      await request(app)
        .post('/api/previsioni/presa-dal-path')
        .send({ ...bodyMinimo, presaId: 'presa-nel-body' });

      expect(previsioneRepository.crea).toHaveBeenCalledWith(expect.objectContaining({ presaId: 'presa-dal-path' }));
    });
  });

  describe('GET /api/previsioni/:presaId/ultima (nessun verifyToken)', () => {
    test('risponde 200 con la previsione trovata, senza header Authorization', async () => {
      previsioneRepository.trovaUltimaPerPresa.mockResolvedValue({ _id: '1', presaId: 'presa1' });

      const res = await request(app).get('/api/previsioni/presa1/ultima');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ _id: '1', presaId: 'presa1' });
    });

    test('risponde 404 con il messaggio esatto se non esiste nessuna previsione per il presaId', async () => {
      previsioneRepository.trovaUltimaPerPresa.mockResolvedValue(null);

      const res = await request(app).get('/api/previsioni/sconosciuta/ultima');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ errore: 'Nessuna previsione disponibile per questa presa' });
    });
  });

  describe('POST /api/logs (nuovo, nessun verifyToken)', () => {
    test('risponde 201 SENZA header Authorization', async () => {
      logRepository.crea.mockResolvedValue({ _id: '1' });

      const res = await request(app)
        .post('/api/logs')
        .send({ livello: 'error', evento: 'prophet.forecast_fallito', messaggio: 'storico insufficiente' });

      expect(res.status).toBe(201);
    });

    test('SICUREZZA: un body con origine:"admin" viene comunque salvato con origine:"sistema"', async () => {
      logRepository.crea.mockResolvedValue({ _id: '1' });

      await request(app)
        .post('/api/logs')
        .send({ origine: 'admin', evento: 'x', messaggio: 'y' });

      expect(logRepository.crea).toHaveBeenCalledWith(expect.objectContaining({ origine: 'sistema' }));
    });

    test('risponde 400 se "evento" o "messaggio" mancano', async () => {
      const res = await request(app).post('/api/logs').send({ messaggio: 'senza evento' });

      expect(res.status).toBe(400);
      expect(logRepository.crea).not.toHaveBeenCalled();
    });
  });

  test('REGRESSIONE: GET /api/logs resta protetto da JWT dopo l\'apertura di POST /api/logs (POST pubblica, GET no)', async () => {
    const res = await request(app).get('/api/logs');

    expect(res.status).toBe(401);
    expect(logRepository.trova).not.toHaveBeenCalled();
  });
});