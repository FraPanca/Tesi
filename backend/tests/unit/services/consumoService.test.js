jest.mock('../../../src/repositories/consumoRepository');
jest.mock('../../../src/repositories/presaRepository');

const consumoRepository = require('../../../src/repositories/consumoRepository');
const presaRepository = require('../../../src/repositories/presaRepository');
const consumoService = require('../../../src/services/consumoService');


describe('consumoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consumoRepository.salva.mockResolvedValue({});
    consumoRepository.aggiornaCache.mockResolvedValue();
    // Reset degli hook globali del modulo tra un test e l'altro, dato che sono stato mutabile condiviso a livello di modulo.
    consumoService.impostaNotificaWebSocket(() => {});
    consumoService.impostaGestoreSoglia(async () => {});
  });

  describe('salvaDatoOttimizzato', () => {
    test('salva su mongo, aggiorna la cache e notifica via websocket', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1', sogliaPotenza: null, stato: 'on' });
      const notifica = jest.fn();
      consumoService.impostaNotificaWebSocket(notifica);

      const risultato = await consumoService.salvaDatoOttimizzato({
        presaId: 'presa1',
        timestamp: '2026-07-20T10:00:00.000Z',
        potenza: 50,
        tensione: 230,
        corrente: 0.22,
      });

      expect(consumoRepository.salva).toHaveBeenCalledWith(
        expect.objectContaining({ presaId: 'presa1', potenza: 50, tensione: 230, corrente: 0.22 })
      );
      expect(consumoRepository.aggiornaCache).toHaveBeenCalledWith('presa1', expect.objectContaining({ potenza: 50 }));
      expect(notifica).toHaveBeenCalledWith('presa1', expect.objectContaining({ potenza: 50 }));
      expect(risultato.timestamp).toEqual(new Date('2026-07-20T10:00:00.000Z'));
    });

    test('usa la data corrente se il timestamp non è fornito', async () => {
      presaRepository.findByPresaId.mockResolvedValue(null);
      const prima = Date.now();

      const risultato = await consumoService.salvaDatoOttimizzato({
        presaId: 'presa1',
        potenza: 10,
        tensione: 230,
        corrente: 0.04,
      });

      expect(risultato.timestamp.getTime()).toBeGreaterThanOrEqual(prima);
    });
  });

  describe('verificaSogliaPotenza (invocata da salvaDatoOttimizzato)', () => {
    test('invia il comando di spegnimento se la potenza supera la soglia e la presa è accesa', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1', sogliaPotenza: 100, stato: 'on' });
      const gestoreSoglia = jest.fn().mockResolvedValue();
      consumoService.impostaGestoreSoglia(gestoreSoglia);

      await consumoService.salvaDatoOttimizzato({ presaId: 'presa1', potenza: 150, tensione: 230, corrente: 0.65 });

      expect(gestoreSoglia).toHaveBeenCalledWith('presa1');
    });

    test('NON invia il comando se la potenza è sotto la soglia', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1', sogliaPotenza: 100, stato: 'on' });
      const gestoreSoglia = jest.fn().mockResolvedValue();
      consumoService.impostaGestoreSoglia(gestoreSoglia);

      await consumoService.salvaDatoOttimizzato({ presaId: 'presa1', potenza: 80, tensione: 230, corrente: 0.35 });

      expect(gestoreSoglia).not.toHaveBeenCalled();
    });

    test('NON invia il comando se la presa risulta già "off" (evita comandi ripetuti)', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1', sogliaPotenza: 100, stato: 'off' });
      const gestoreSoglia = jest.fn().mockResolvedValue();
      consumoService.impostaGestoreSoglia(gestoreSoglia);

      await consumoService.salvaDatoOttimizzato({ presaId: 'presa1', potenza: 150, tensione: 230, corrente: 0.65 });

      expect(gestoreSoglia).not.toHaveBeenCalled();
    });

    test('NON invia il comando se la presa non ha una soglia impostata (sogliaPotenza null)', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1', sogliaPotenza: null, stato: 'on' });
      const gestoreSoglia = jest.fn().mockResolvedValue();
      consumoService.impostaGestoreSoglia(gestoreSoglia);

      await consumoService.salvaDatoOttimizzato({ presaId: 'presa1', potenza: 99999, tensione: 230, corrente: 400 });

      expect(gestoreSoglia).not.toHaveBeenCalled();
    });

    test('non fa nulla se la presa non viene trovata (nessun errore lanciato)', async () => {
      presaRepository.findByPresaId.mockResolvedValue(null);
      const gestoreSoglia = jest.fn().mockResolvedValue();
      consumoService.impostaGestoreSoglia(gestoreSoglia);

      await expect(
        consumoService.salvaDatoOttimizzato({ presaId: 'sconosciuta', potenza: 500, tensione: 230, corrente: 2 })
      ).resolves.toBeDefined();
      expect(gestoreSoglia).not.toHaveBeenCalled();
    });
  });

  describe('consumiPresa', () => {
    test('lancia ServiceError 404 se la presa non esiste', async () => {
      presaRepository.findByPresaId.mockResolvedValue(null);

      await expect(consumoService.consumiPresa('inesistente')).rejects.toMatchObject({
        status: 404,
      });
    });

    test('ritorna il risultato dalla cache range se presente, senza interrogare Mongo', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1' });
      consumoRepository.leggiCacheRange.mockResolvedValue([{ potenza: 1 }]);

      const risultato = await consumoService.consumiPresa('presa1', {});

      expect(risultato).toEqual([{ potenza: 1 }]);
      expect(consumoRepository.trovaPerPresaERange).not.toHaveBeenCalled();
    });

    test('interroga Mongo e scrive in cache se la cache range è vuota', async () => {
      presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1' });
      consumoRepository.leggiCacheRange.mockResolvedValue(null);
      consumoRepository.trovaPerPresaERange.mockResolvedValue([{ potenza: 2 }]);

      const risultato = await consumoService.consumiPresa('presa1', {});

      expect(risultato).toEqual([{ potenza: 2 }]);
      expect(consumoRepository.scriviCacheRange).toHaveBeenCalledWith('presa1', undefined, undefined, [
        { potenza: 2 },
      ]);
    });
  });
});