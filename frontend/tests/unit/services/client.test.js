import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, setAuthToken, setUnauthorizedHandler, ApiError } from '../../../src/services/api/client';


function mockResponse({ status = 200, body = null } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  };
}


describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    setAuthToken(null);
    setUnauthorizedHandler(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('esegue una GET senza Content-Type e senza Authorization di default', async () => {
    fetch.mockResolvedValue(mockResponse({ status: 200, body: { ok: true } }));

    await apiFetch('/api/prese');

    expect(fetch).toHaveBeenCalledWith('/api/prese', {
      method: 'GET',
      headers: {},
      body: undefined,
    });
  });

  test("imposta Content-Type: application/json quando c'è un body e lo serializza", async () => {
    fetch.mockResolvedValue(mockResponse({ status: 200, body: {} }));

    await apiFetch('/api/prese', { method: 'POST', body: { nome: 'Frigo' } });

    expect(fetch).toHaveBeenCalledWith('/api/prese', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Frigo' }),
    });
  });

  test("aggiunge Authorization solo se auth:true ED è presente un token", async () => {
    setAuthToken('il-mio-token');
    fetch.mockResolvedValue(mockResponse({ status: 200, body: [] }));

    await apiFetch('/api/logs', { auth: true });

    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer il-mio-token');
  });

  test("NON aggiunge Authorization se auth:true ma non c'è nessun token impostato", async () => {
    setAuthToken(null);
    fetch.mockResolvedValue(mockResponse({ status: 200, body: [] }));

    await apiFetch('/api/logs', { auth: true });

    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test('NON aggiunge Authorization se è presente un token ma auth non è true', async () => {
    setAuthToken('il-mio-token');
    fetch.mockResolvedValue(mockResponse({ status: 200, body: [] }));

    await apiFetch('/api/prese');

    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test('ritorna null su 204 senza provare a leggere il body', async () => {
    const res = mockResponse({ status: 204 });
    res.json = vi.fn();
    fetch.mockResolvedValue(res);

    const risultato = await apiFetch('/api/prese/presa1', { method: 'DELETE' });

    expect(risultato).toBeNull();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('lancia una ApiError con messaggio e status del backend su risposta non ok', async () => {
    fetch.mockResolvedValue(mockResponse({ status: 409, body: { errore: 'IP già in uso' } }));

    let erroreCatturato;
    await apiFetch('/api/prese', { method: 'POST', body: {} }).catch((err) => {
      erroreCatturato = err;
    });

    expect(erroreCatturato).toBeInstanceOf(ApiError);
    expect(erroreCatturato.message).toBe('IP già in uso');
    expect(erroreCatturato.status).toBe(409);
  });

  test('usa un messaggio di default "Errore <status>" se il body di errore non è leggibile', async () => {
    const res = mockResponse({ status: 500 });
    res.json = () => Promise.reject(new Error('non è JSON'));
    fetch.mockResolvedValue(res);

    await expect(apiFetch('/api/prese')).rejects.toMatchObject({ message: 'Errore 500', status: 500 });
  });

  test("un 401 su una chiamata autenticata (auth:true) invoca l'handler di unauthorized", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetch.mockResolvedValue(mockResponse({ status: 401, body: { errore: 'Token scaduto' } }));

    await expect(apiFetch('/api/logs', { auth: true })).rejects.toThrow();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('un 401 su una chiamata NON autenticata NON invoca l\'handler (evita logout su endpoint pubblici)', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetch.mockResolvedValue(mockResponse({ status: 401, body: { errore: 'Non autorizzato' } }));

    await expect(apiFetch('/api/qualcosa-pubblico')).rejects.toThrow();

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});