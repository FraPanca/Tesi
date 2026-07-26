jest.mock('../../../src/repositories/presaRepository');
jest.mock('../../../src/services/consumoService', () => ({ cancellaCachePresa: jest.fn() }));
jest.mock('../../../src/mqtt/client', () => ({ registraDispositivo: jest.fn(), rimuoviDispositivo: jest.fn() }));

const presaRepository = require('../../../src/repositories/presaRepository');
const consumoService = require('../../../src/services/consumoService');
const mqttClient = require('../../../src/mqtt/client');
const presaService = require('../../../src/services/presaService');


describe('presaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dettaglioPresa', () => {
    test('lancia ServiceError 404 se la presa non esiste', async () => {
      presaRepository.findByPresaId.mockResolvedValue(null);
      await expect(presaService.dettaglioPresa('inesistente')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('creaPresa', () => {
    test('lancia ServiceError 400 se manca un campo obbligatorio', async () => {
      await expect(presaService.creaPresa({ nome: 'Frigo', ip: '192.168.1.10' })).rejects.toMatchObject({
        status: 400,
      });
      expect(presaRepository.create).not.toHaveBeenCalled();
    });

    test('lancia ServiceError 409 se presaId già registrato', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1' });

      await expect(
        presaService.creaPresa({ presaId: 'presa1', nome: 'Frigo', ip: '192.168.1.10' })
      ).rejects.toMatchObject({ status: 409 });
      expect(presaRepository.create).not.toHaveBeenCalled();
    });

    test('lancia ServiceError 409 se l\'ip è già usato da un\'altra presa', async () => {
      presaRepository.findByPresaId.mockResolvedValue(null);
      presaRepository.findByIp.mockResolvedValue({ presaId: 'presa2', ip: '192.168.1.10' });

      await expect(
        presaService.creaPresa({ presaId: 'presa1', nome: 'Frigo', ip: '192.168.1.10' })
      ).rejects.toMatchObject({ status: 409 });
      expect(presaRepository.create).not.toHaveBeenCalled();
    });

    test('crea la presa e registra il dispositivo verso il gateway via MQTT', async () => {
      presaRepository.findByPresaId.mockResolvedValue(null);
      presaRepository.findByIp.mockResolvedValue(null);
      const presaCreata = { presaId: 'presa1', nome: 'Frigo', ip: '192.168.1.10', sogliaPotenza: 200 };
      presaRepository.create.mockResolvedValue(presaCreata);

      const risultato = await presaService.creaPresa({
        presaId: 'presa1',
        nome: 'Frigo',
        ip: '192.168.1.10',
        sogliaPotenza: 200,
      });

      expect(risultato).toEqual(presaCreata);
      expect(mqttClient.registraDispositivo).toHaveBeenCalledWith('192.168.1.10', 'presa1');
    });
  });

  describe('aggiornaPresa', () => {
    test('lancia ServiceError 400 se non viene passato nessun campo modificabile', async () => {
      await expect(presaService.aggiornaPresa('presa1', { stato: 'on' })).rejects.toMatchObject({
        status: 400,
      });
      expect(presaRepository.updateByPresaId).not.toHaveBeenCalled();
    });

    test('ignora "stato" e aggiorna solo nome/sogliaPotenza', async () => {
      presaRepository.updateByPresaId.mockResolvedValue({ presaId: 'presa1', nome: 'Nuovo nome' });

      await presaService.aggiornaPresa('presa1', { nome: 'Nuovo nome', stato: 'off' });

      expect(presaRepository.updateByPresaId).toHaveBeenCalledWith('presa1', { nome: 'Nuovo nome' });
    });

    test('lancia ServiceError 404 se la presa non esiste', async () => {
      presaRepository.updateByPresaId.mockResolvedValue(null);

      await expect(presaService.aggiornaPresa('inesistente', { nome: 'X' })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('rimuoviPresa', () => {
    test('lancia ServiceError 404 se la presa non esiste', async () => {
      presaRepository.deleteByPresaId.mockResolvedValue(null);
      await expect(presaService.rimuoviPresa('inesistente')).rejects.toMatchObject({ status: 404 });
    });

    test('deregistra il dispositivo dal gateway e ripulisce la cache Redis associata', async () => {
      presaRepository.deleteByPresaId.mockResolvedValue({ presaId: 'presa1', ip: '192.168.1.10' });

      await presaService.rimuoviPresa('presa1');

      expect(mqttClient.rimuoviDispositivo).toHaveBeenCalledWith('192.168.1.10');
      expect(consumoService.cancellaCachePresa).toHaveBeenCalledWith('presa1');
    });
  });
});