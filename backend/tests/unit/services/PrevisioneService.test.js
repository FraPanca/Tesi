jest.mock('../../../src/repositories/previsioneRepository');

const previsioneRepository = require('../../../src/repositories/previsioneRepository');
const previsioneService = require('../../../src/services/previsioneService');

const BODY_MINIMO = {
  orizzonte: { da: '2026-08-11T00:00:00Z', a: '2026-08-17T23:00:00Z' },
  valoriPrevisti: [{ ds: '2026-08-11T00:00:00Z', yhat: 45.2 }],
};


describe('previsioneService.salvaPrevisione', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    previsioneRepository.crea.mockResolvedValue({ _id: '1' });
  });

  describe('validazione struttura', () => {
    test('lancia ServiceError 400 se orizzonte manca del tutto', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', { valoriPrevisti: BODY_MINIMO.valoriPrevisti })
      ).rejects.toMatchObject({ status: 400 });
    });

    test('lancia ServiceError 400 se orizzonte.da manca', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', { ...BODY_MINIMO, orizzonte: { a: BODY_MINIMO.orizzonte.a } })
      ).rejects.toMatchObject({ status: 400 });
    });

    test('lancia ServiceError 400 se valoriPrevisti manca o è un array vuoto', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', { orizzonte: BODY_MINIMO.orizzonte })
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        previsioneService.salvaPrevisione('presa1', { ...BODY_MINIMO, valoriPrevisti: [] })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('haTimezoneEsplicito — i quattro punti di validazione', () => {
    test('accetta stringhe con "Z", con offset +hh:mm/-hh:mm, e oggetti Date reali', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          orizzonte: { da: '2026-08-11T00:00:00Z', a: new Date('2026-08-17T23:00:00-05:00') },
          valoriPrevisti: [{ ds: '2026-08-11T00:00:00+02:00', yhat: 1 }],
        })
      ).resolves.toBeDefined();
    });

    test('rifiuta orizzonte.da senza timezone esplicito, con messaggio che lo identifica', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          ...BODY_MINIMO,
          orizzonte: { da: '2026-08-11T00:00:00', a: BODY_MINIMO.orizzonte.a },
        })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('orizzonte.da') });
    });

    test('rifiuta orizzonte.a senza timezone esplicito, con messaggio che lo identifica', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          ...BODY_MINIMO,
          orizzonte: { da: BODY_MINIMO.orizzonte.da, a: '2026-08-17 23:00:00' },
        })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('orizzonte.a') });
    });

    test('rifiuta un valoriPrevisti[].ds naive (formato pandas/Prophet, senza T né timezone)', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          ...BODY_MINIMO,
          valoriPrevisti: [{ ds: '2026-08-11 14:00:00', yhat: 1 }],
        })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('valoriPrevisti[0].ds') });
    });

    test('rifiuta un valoriPrevisti[].ds con "T" ma senza timezone', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          ...BODY_MINIMO,
          valoriPrevisti: [{ ds: '2026-08-11T14:00:00', yhat: 1 }],
        })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('valoriPrevisti[0].ds') });
    });

    test('rifiuta un valoriPrevisti[].ds con timezone ma data non valida (es. "pippo+02:00")', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          ...BODY_MINIMO,
          valoriPrevisti: [{ ds: 'pippo+02:00', yhat: 1 }],
        })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('valoriPrevisti[0].ds') });
    });

    test('con più punti, identifica l\'INDICE ESATTO del punto ambiguo (non il primo, non un indice generico)', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          ...BODY_MINIMO,
          valoriPrevisti: [
            { ds: '2026-08-11T00:00:00Z', yhat: 1 },
            { ds: '2026-08-11T01:00:00', yhat: 2 }, // solo questo è ambiguo
          ],
        })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('valoriPrevisti[1].ds') });
    });

    test('rifiuta anomalie[].ds naive, con messaggio che identifica l\'indice nell\'array anomalie', async () => {
      await expect(
        previsioneService.salvaPrevisione('presa1', {
          ...BODY_MINIMO,
          anomalie: [
            { ds: '2026-08-06T00:00:00Z', y: 900, punteggio: -0.72 },
            { ds: '2026-08-09T03:00:00', y: 780.5, punteggio: -0.41 }, // ambiguo
          ],
        })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('anomalie[1].ds') });
    });

    test('anomalie assente o vuoto: nessuna validazione richiesta, la creazione procede', async () => {
      await expect(previsioneService.salvaPrevisione('presa1', BODY_MINIMO)).resolves.toBeDefined();
      await expect(
        previsioneService.salvaPrevisione('presa1', { ...BODY_MINIMO, anomalie: [] })
      ).resolves.toBeDefined();
    });
  });

  describe('presaId e metriche', () => {
    test('usa il presaId passato come parametro, ignora un eventuale presaId nel body', async () => {
      await previsioneService.salvaPrevisione('presa-dal-path', { ...BODY_MINIMO, presaId: 'presa-nel-body' });

      expect(previsioneRepository.crea).toHaveBeenCalledWith(
        expect.objectContaining({ presaId: 'presa-dal-path' })
      );
    });

    test('accetta un body SENZA metriche (scrittura di produzione giornaliera)', async () => {
      await previsioneService.salvaPrevisione('presa1', BODY_MINIMO);

      expect(previsioneRepository.crea).toHaveBeenCalledWith(
        expect.objectContaining({ metriche: undefined })
      );
    });

    test('accetta un body CON metriche (valutazione offline)', async () => {
      const metriche = { mae: 12.4, rmse: 18.9, baselineConfronto: 'media mobile 7gg' };
      await previsioneService.salvaPrevisione('presa1', { ...BODY_MINIMO, metriche });

      expect(previsioneRepository.crea).toHaveBeenCalledWith(expect.objectContaining({ metriche }));
    });

    test('propaga suggerimenti/anomalie così come arrivano', async () => {
      const suggerimenti = ['Il consumo medio previsto supera la soglia in 1 giorno.'];
      const anomalie = [{ ds: '2026-08-06T00:00:00Z', y: 900, punteggio: -0.72 }];

      await previsioneService.salvaPrevisione('presa1', { ...BODY_MINIMO, suggerimenti, anomalie });

      expect(previsioneRepository.crea).toHaveBeenCalledWith(expect.objectContaining({ suggerimenti, anomalie }));
    });
  });

  test('ogni chiamata crea un NUOVO documento: due chiamate per lo stesso presaId -> repository.crea chiamato due volte, mai un update', async () => {
    await previsioneService.salvaPrevisione('presa1', BODY_MINIMO);
    await previsioneService.salvaPrevisione('presa1', BODY_MINIMO);

    expect(previsioneRepository.crea).toHaveBeenCalledTimes(2);
  });
});

describe('previsioneService.ultimaPrevisione', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ritorna il documento trovato dal repository', async () => {
    const previsione = { _id: '1', presaId: 'presa1' };
    previsioneRepository.trovaUltimaPerPresa.mockResolvedValue(previsione);

    await expect(previsioneService.ultimaPrevisione('presa1')).resolves.toBe(previsione);
  });

  test('lancia ServiceError 404 con il messaggio esatto se non esiste nulla per il presaId', async () => {
    previsioneRepository.trovaUltimaPerPresa.mockResolvedValue(null);

    await expect(previsioneService.ultimaPrevisione('presa-senza-previsioni')).rejects.toMatchObject({
      status: 404,
      message: 'Nessuna previsione disponibile per questa presa',
    });
  });
});