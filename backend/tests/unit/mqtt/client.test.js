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

async function flush(volte = 1) {
  for (let i = 0; i < volte; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

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

  function payloadEsp32({
    power_w = 42.5,
    voltage_v = 230.1,
    current_a = 0.18,
    timestamp_end = 1_753_500_000,
    timestamp_start = 1_753_499_970,
    valore_singolo = false,
  } = {}) {
    return Buffer.from(
      JSON.stringify({ power_w, voltage_v, current_a, timestamp_end, timestamp_start, valore_singolo })
    );
  }

  test('si sottoscrive a home/+/optimized e healthcheck/response alla connessione', () => {
    expect(fakeClient.subscribe).toHaveBeenCalledWith('home/+/optimized', { qos: 1 }, expect.any(Function));
    expect(fakeClient.subscribe).toHaveBeenCalledWith(
      'home/system/healthcheck/response',
      { qos: 0 },
      expect.any(Function)
    );
  });

  test('un messaggio su home/<presaId>/optimized viene mappato (incluso valoreSingolo/timestampInizio) e passato al service completo di ogni campo', async () => {
    fakeClient.emit(
      'message',
      'home/presa2/optimized',
      payloadEsp32({
        power_w: 55,
        voltage_v: 228,
        current_a: 0.24,
        timestamp_end: 1_753_500_000,
        timestamp_start: 1_753_499_970,
        valore_singolo: true,
      })
    );
    await flush();

    expect(consumoService.salvaDatoOttimizzato).toHaveBeenCalledWith({
      presaId: 'presa2',
      potenza: 55,
      tensione: 228,
      corrente: 0.24,
      timestamp: new Date(1_753_500_000 * 1000),
      timestampInizio: new Date(1_753_499_970 * 1000),
      valoreSingolo: true,
    });
  });

  test('l\'evento pubblico "datoOttimizzato" NON contiene mai timestampInizio né valoreSingolo (solo i 5 campi pubblici)', async () => {
    const listener = jest.fn();
    mqttEvents.on('datoOttimizzato', listener);

    fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32({ valore_singolo: true }));
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
    const evento = listener.mock.calls[0][0];
    expect(Object.keys(evento).sort()).toEqual(['corrente', 'potenza', 'presaId', 'tensione', 'timestamp'].sort());
  });

  test('se il salvataggio fallisce dopo i retry, viene scritto un log di sistema e NON viene lanciata eccezione', async () => {
    consumoService.salvaDatoOttimizzato.mockRejectedValue(new Error('Mongo non raggiungibile'));

    expect(() => {
      fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32());
    }).not.toThrow();

    await flush();

    expect(Log.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origine: 'sistema',
        livello: 'error',
        evento: 'mqtt.retry_esaurito',
        metadati: { presaId: 'presa1' },
      })
    );
  });

  test('REGRESSIONE: se retryConBackoff esaurisce i tentativi, NON genera una unhandled promise rejection', async () => {
    consumoService.salvaDatoOttimizzato.mockRejectedValue(new Error('Mongo non raggiungibile'));

    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    try {
      fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32());
      // L'unhandled rejection (se presente) si manifesta in modo asincrono: diversi giri di flush
      // per dare al bug la possibilità di manifestarsi prima di asserire che non è successo.
      await flush(5);

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
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

  test('due messaggi consecutivi per la STESSA presa sono processati in sequenza stretta (accodaPerPresa)', async () => {
    const ordine = [];
    let risolviPrimo;
    consumoService.salvaDatoOttimizzato
      .mockImplementationOnce(() => {
        ordine.push('inizio-1');
        return new Promise((resolve) => {
          risolviPrimo = () => {
            ordine.push('fine-1');
            resolve({});
          };
        });
      })
      .mockImplementationOnce(() => {
        ordine.push('inizio-2');
        return Promise.resolve({});
      });

    fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32());
    fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32());
    await flush(2);

    // Il secondo messaggio non deve ancora essere partito: il primo è ancora "in volo".
    expect(ordine).toEqual(['inizio-1']);

    risolviPrimo();
    await flush(3);

    expect(ordine).toEqual(['inizio-1', 'fine-1', 'inizio-2']);
  });

  test('due prese DIVERSE non si bloccano a vicenda (code indipendenti per presaId)', async () => {
    const ordine = [];
    let risolviPresa1;
    consumoService.salvaDatoOttimizzato.mockImplementation((arg) => {
      if (arg.presaId === 'presa1') {
        ordine.push('inizio-presa1');
        return new Promise((resolve) => {
          risolviPresa1 = () => {
            ordine.push('fine-presa1');
            resolve({});
          };
        });
      }
      ordine.push('presa2-eseguito');
      return Promise.resolve({});
    });

    fakeClient.emit('message', 'home/presa1/optimized', payloadEsp32());
    fakeClient.emit('message', 'home/presa2/optimized', payloadEsp32());
    await flush(3);

    expect(ordine).toContain('presa2-eseguito');
    expect(ordine).not.toContain('fine-presa1');

    risolviPresa1();
    await flush(2);
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