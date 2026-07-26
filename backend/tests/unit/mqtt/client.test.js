const { EventEmitter } = require('events');

// retryConBackoff è già testato in isolamento (tests/unit/utils/retry.test.js): qui viene sostituito con una versione che chiama semplicemente
// fn() una volta, così i test restano veloci e concentrati sul comportamento di client.js attorno al retry, non sul backoff in sé.
jest.mock('mqtt', () => ({ connect: jest.fn() }));
jest.mock('../../../src/services/consumoService', () => ({ salvaDatoOttimizzato: jest.fn() }));
jest.mock('../../../src/utils/retry', () => ({ retryConBackoff: jest.fn((fn) => fn()) }));
jest.mock('../../../src/models/Log', () => ({ create: jest.fn().mockResolvedValue({}) }));

const mqtt = require('mqtt');
const consumoService = require('../../../src/services/consumoService');
const { retryConBackoff } = require('../../../src/utils/retry');
const Log = require('../../../src/models/Log');
const { connettiMqtt, inviaComando, mqttEvents } = require('../../../src/mqtt/client');


describe('mqtt/client', () => {
  let fakeClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // consumoService.salvaDatoOttimizzato di default ha successo: i singoli test di fallimento lo sovrascrivono con mockRejectedValue.
    consumoService.salvaDatoOttimizzato.mockResolvedValue({});

    fakeClient = new EventEmitter();
    fakeClient.subscribe = jest.fn((topic, opts, cb) => cb && cb(null));
    fakeClient.publish = jest.fn((topic, payload, cb) => cb && cb(null));
    mqtt.connect.mockReturnValue(fakeClient);

    connettiMqtt();
    fakeClient.emit('connect');
  });

  afterEach(() => {
    mqttEvents.removeAllListeners();
  });

  function payloadEsp32({ power_w = 42.5, voltage_v = 230.1, current_a = 0.18, timestamp_end = 1_753_500_000 } = {}) {
    return Buffer.from(JSON.stringify({ power_w, voltage_v, current_a, timestamp_end }));
  }

  test('si sottoscrive a home/+/optimized e healthcheck/response alla connessione', () => {
    expect(fakeClient.subscribe).toHaveBeenCalledWith('home/+/optimized', { qos: 1 }, expect.any(Function));
    expect(fakeClient.subscribe).toHaveBeenCalledWith(
      'home/system/healthcheck/response',
      { qos: 0 },
      expect.any(Function)
    );
  });

  test('un messaggio su home/<presaId>/optimized viene mappato e passato al service con il presaId estratto dal topic', async () => {
    fakeClient.emit('message', 'home/presa2/optimized', payloadEsp32({ power_w: 55, voltage_v: 228, current_a: 0.24, timestamp_end: 1_753_500_000 }));

    // Il gestore del messaggio è async (contiene await): si aspetta il flush della coda di microtask.
    await new Promise((resolve) => setImmediate(resolve));

    expect(consumoService.salvaDatoOttimizzato).toHaveBeenCalledWith({
      presaId: 'presa2',
      potenza: 55,
      tensione: 228,
      corrente: 0.24,
      timestamp: new Date(1_753_500_000 * 1000),
    });
  });

  test('emette "datoOttimizzato" su mqttEvents dopo il salvataggio', async () => {
    const listener = jest.fn();
    mqttEvents.on('datoOttimizzato', listener);

    fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32());
    await new Promise((resolve) => setImmediate(resolve));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ presaId: 'presa1', potenza: 42.5 })
    );
  });

  test('se il salvataggio fallisce dopo i retry, viene scritto un log di sistema e NON viene lanciata eccezione', async () => {
    consumoService.salvaDatoOttimizzato.mockRejectedValue(new Error('Mongo non raggiungibile'));

    expect(() => {
      fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32());
    }).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));

    expect(Log.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origine: 'sistema',
        livello: 'error',
        evento: 'mqtt.retry_esaurito',
        metadati: { presaId: 'presa1' },
      })
    );
  });

  test('un messaggio con payload non JSON non blocca il client (errore loggato, nessun crash)', () => {
    expect(() => {
      fakeClient.emit('message', 'home/presa1/optimized', Buffer.from('non-e-json'));
    }).not.toThrow();
    expect(consumoService.salvaDatoOttimizzato).not.toHaveBeenCalled();
  });

  test('un messaggio su healthcheck/response NON passa dal flusso "optimized" ed emette healthcheckResponse', () => {
    const listener = jest.fn();
    mqttEvents.on('healthcheckResponse', listener);

    fakeClient.emit(
      'message',
      'home/system/healthcheck/response',
      Buffer.from(JSON.stringify({ componente: 'gateway', stato: 'OK' }))
    );

    expect(listener).toHaveBeenCalledWith({ componente: 'gateway', stato: 'OK' });
    expect(consumoService.salvaDatoOttimizzato).not.toHaveBeenCalled();
  });

  test('inviaComando pubblica su home/<presaId>/commands con action e ip nel payload', async () => {
    await inviaComando('presa3', '192.168.1.50', 'off');

    expect(retryConBackoff).toHaveBeenCalled();
    expect(fakeClient.publish).toHaveBeenCalledWith(
      'home/presa3/commands',
      JSON.stringify({ action: 'off', ip: '192.168.1.50' }),
      expect.any(Function)
    );
  });
});