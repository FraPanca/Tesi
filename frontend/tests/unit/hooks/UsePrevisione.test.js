import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../src/services/api/previsioni', () => ({ getUltima: vi.fn() }));

import * as previsioniApi from '../../../src/services/api/previsioni';
import { ApiError } from '../../../src/services/api/client';
import usePrevisione from '../../../src/hooks/usePrevisione';


function previsione({ generatoIl }) {
  return { presaId: 'presa1', generatoIl, valoriPrevisti: [{ ds: '2026-08-11T00:00:00Z', yhat: 1 }] };
}

describe('usePrevisione', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('stato "loading" subito dopo il mount, poi "disponibile" con generatoIl recente', async () => {
    const generatoIl = new Date().toISOString();
    previsioniApi.getUltima.mockResolvedValue(previsione({ generatoIl }));

    const { result } = renderHook(() => usePrevisione('presa1'));
    expect(result.current.stato).toBe('loading');

    await waitFor(() => expect(result.current.stato).toBe('disponibile'));
    expect(result.current.previsione).toEqual(expect.objectContaining({ generatoIl }));
    expect(result.current.error).toBeNull();
  });

  test('404 dalla API -> stato "assente", NON "errore"', async () => {
    previsioniApi.getUltima.mockRejectedValue(
      new ApiError('Nessuna previsione disponibile per questa presa', 404)
    );

    const { result } = renderHook(() => usePrevisione('presa1'));
    await waitFor(() => expect(result.current.stato).toBe('assente'));

    expect(result.current.previsione).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('previsione con generatoIl più vecchio della soglia di freschezza (30h) -> "assente", pur avendo ricevuto un documento valido (non un 404)', async () => {
    const generatoIl = new Date(Date.now() - 31 * 60 * 60 * 1000).toISOString(); // 31h fa
    previsioniApi.getUltima.mockResolvedValue(previsione({ generatoIl }));

    const { result } = renderHook(() => usePrevisione('presa1'));
    await waitFor(() => expect(result.current.stato).toBe('assente'));

    expect(result.current.previsione).toBeNull();
  });

  test('previsione con generatoIl recente (29h, sotto soglia) -> "disponibile"', async () => {
    const generatoIl = new Date(Date.now() - 29 * 60 * 60 * 1000).toISOString();
    previsioniApi.getUltima.mockResolvedValue(previsione({ generatoIl }));

    const { result } = renderHook(() => usePrevisione('presa1'));
    await waitFor(() => expect(result.current.stato).toBe('disponibile'));
  });

  test('un errore diverso da 404 (es. 500) -> stato "errore", NON "assente"', async () => {
    previsioniApi.getUltima.mockRejectedValue(new ApiError('Errore interno', 500));

    const { result } = renderHook(() => usePrevisione('presa1'));
    await waitFor(() => expect(result.current.stato).toBe('errore'));

    expect(result.current.error).toBe('Errore interno');
    expect(result.current.previsione).toBeNull();
  });

  test('un errore senza status (es. rete assente) -> stato "errore"', async () => {
    previsioniApi.getUltima.mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => usePrevisione('presa1'));
    await waitFor(() => expect(result.current.stato).toBe('errore'));

    expect(result.current.error).toBe('Failed to fetch');
  });

  test('senza presaId, va direttamente a "assente" senza chiamare la API', () => {
    const { result } = renderHook(() => usePrevisione(undefined));

    expect(result.current.stato).toBe('assente');
    expect(previsioniApi.getUltima).not.toHaveBeenCalled();
  });
});