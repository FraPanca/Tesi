jest.mock('../../../src/repositories/logRepository');

const logRepository = require('../../../src/repositories/logRepository');
const logService = require('../../../src/services/logService');


describe('logService.cercaLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logRepository.trova.mockResolvedValue([]);
  });

  test('lancia ServiceError 400 se il livello non è tra quelli validi', async () => {
    await expect(logService.cercaLog({ livello: 'debug' })).rejects.toMatchObject({ status: 400 });
    expect(logRepository.trova).not.toHaveBeenCalled();
  });

  test('lancia ServiceError 400 se l\'origine non è tra quelle valide', async () => {
    await expect(logService.cercaLog({ origine: 'esp32' })).rejects.toMatchObject({ status: 400 });
    expect(logRepository.trova).not.toHaveBeenCalled();
  });

  test('lancia ServiceError 400 se "da" o "a" non sono date valide', async () => {
    await expect(logService.cercaLog({ da: 'non-una-data' })).rejects.toMatchObject({ status: 400 });
    await expect(logService.cercaLog({ a: 'non-una-data' })).rejects.toMatchObject({ status: 400 });
  });

  test('accetta livello/origine validi e converte le date prima di passarle al repository', async () => {
    await logService.cercaLog({
      livello: 'error',
      origine: 'sistema',
      da: '2026-07-01',
      a: '2026-07-20',
      limite: '50',
    });

    expect(logRepository.trova).toHaveBeenCalledWith({
      evento: undefined,
      livello: 'error',
      origine: 'sistema',
      da: new Date('2026-07-01'),
      a: new Date('2026-07-20'),
      limite: 50,
    });
  });

  test('funziona senza nessun filtro (tutti i parametri opzionali)', async () => {
    await logService.cercaLog();

    expect(logRepository.trova).toHaveBeenCalledWith({
      evento: undefined,
      livello: undefined,
      origine: undefined,
      da: undefined,
      a: undefined,
      limite: undefined,
    });
  });
});

describe('logService.creaLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logRepository.crea.mockResolvedValue({ _id: '1' });
  });

  test('lancia ServiceError 400 se "evento" manca', async () => {
    await expect(
      logService.creaLog({ origine: 'sistema', messaggio: 'qualcosa' })
    ).rejects.toMatchObject({ status: 400 });
    expect(logRepository.crea).not.toHaveBeenCalled();
  });

  test('lancia ServiceError 400 se "messaggio" manca', async () => {
    await expect(
      logService.creaLog({ origine: 'sistema', evento: 'prophet.forecast_fallito' })
    ).rejects.toMatchObject({ status: 400 });
    expect(logRepository.crea).not.toHaveBeenCalled();
  });

  test('lancia ServiceError 400 se "livello" è presente ma non valido', async () => {
    await expect(
      logService.creaLog({
        origine: 'sistema',
        evento: 'x',
        messaggio: 'y',
        livello: 'debug',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('lancia ServiceError 400 se "origine" non è tra quelle valide', async () => {
    await expect(
      logService.creaLog({ origine: 'esp32', evento: 'x', messaggio: 'y' })
    ).rejects.toMatchObject({ status: 400 });
    expect(logRepository.crea).not.toHaveBeenCalled();
  });

  test('con i campi obbligatori validi, chiama il repository con i dati corretti', async () => {
    await logService.creaLog({
      origine: 'sistema',
      livello: 'error',
      evento: 'prophet.forecast_fallito',
      messaggio: 'storico insufficiente',
      metadati: { presaId: 'camera' },
    });

    expect(logRepository.crea).toHaveBeenCalledWith({
      origine: 'sistema',
      livello: 'error',
      evento: 'prophet.forecast_fallito',
      messaggio: 'storico insufficiente',
      metadati: { presaId: 'camera' },
    });
  });
});