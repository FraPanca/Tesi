const { retryConBackoff } = require('../../../src/utils/retry');


describe('retryConBackoff', () => {
  let setTimeoutSpy;

  beforeEach(() => {
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  test('ritorna subito il risultato se il primo tentativo ha successo (nessuna attesa)', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const risultato = await retryConBackoff(fn);

    expect(risultato).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  test('riprova e ritorna il risultato se un tentativo successivo ha successo', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fallito 1'))
      .mockRejectedValueOnce(new Error('fallito 2'))
      .mockResolvedValueOnce('ok al terzo tentativo');

    const risultato = await retryConBackoff(fn, { tentativiMax: 5, baseMs: 100 });

    expect(risultato).toBe('ok al terzo tentativo');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('il backoff raddoppia ad ogni tentativo (100ms, poi 200ms)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fallito 1'))
      .mockRejectedValueOnce(new Error('fallito 2'))
      .mockResolvedValueOnce('ok');

    await retryConBackoff(fn, { tentativiMax: 5, baseMs: 100 });

    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy.mock.calls[0][1]).toBe(100);
    expect(setTimeoutSpy.mock.calls[1][1]).toBe(200);
  });

  test("lancia l'ultimo errore se tutti i tentativi falliscono", async () => {
    const erroreFinale = new Error('fallito definitivamente');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fallito 1'))
      .mockRejectedValueOnce(new Error('fallito 2'))
      .mockRejectedValueOnce(erroreFinale);

    await expect(retryConBackoff(fn, { tentativiMax: 3, baseMs: 50 })).rejects.toThrow(
      'fallito definitivamente'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("non attende dopo l'ultimo tentativo fallito (nessuna chiamata di troppo a setTimeout)", async () => {
    const fn = jest.fn().mockRejectedValue(new Error('sempre fallito'));

    await expect(retryConBackoff(fn, { tentativiMax: 2, baseMs: 10 })).rejects.toThrow(
      'sempre fallito'
    );

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  test('usa tentativiMax=5 e baseMs=500 quando le opzioni non sono specificate', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fallito'));

    await expect(retryConBackoff(fn)).rejects.toThrow('fallito');

    expect(fn).toHaveBeenCalledTimes(5);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(4);
    expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toEqual([500, 1000, 2000, 4000]);
  });
});