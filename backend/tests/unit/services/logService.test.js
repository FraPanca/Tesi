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