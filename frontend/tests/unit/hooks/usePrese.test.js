import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../src/services/api/prese');


import * as preseApi from '../../../src/services/api/prese';
import usePrese from '../../../src/hooks/usePrese';


describe('usePrese', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('al mount carica le prese da getAll() e imposta loading correttamente', async () => {
    preseApi.getAll.mockResolvedValue([{ presaId: 'presa1', nome: 'Frigo' }]);

    const { result } = renderHook(() => usePrese());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.prese).toEqual([{ presaId: 'presa1', nome: 'Frigo' }]);
    expect(result.current.error).toBeNull();
  });

  test('se getAll fallisce, imposta error e lascia prese vuoto', async () => {
    preseApi.getAll.mockRejectedValue(new Error('Rete non disponibile'));

    const { result } = renderHook(() => usePrese());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Rete non disponibile');
    expect(result.current.prese).toEqual([]);
  });

  test('creaPresa: chiama preseApi.create e aggiunge il risultato alla lista', async () => {
    preseApi.getAll.mockResolvedValue([]);
    const nuovaPresa = { presaId: 'presa2', nome: 'Lavatrice' };
    preseApi.create.mockResolvedValue(nuovaPresa);

    const { result } = renderHook(() => usePrese());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ritorno;
    await act(async () => {
      ritorno = await result.current.creaPresa({ presaId: 'presa2', nome: 'Lavatrice', ip: '192.168.1.30' });
    });

    expect(preseApi.create).toHaveBeenCalledWith({ presaId: 'presa2', nome: 'Lavatrice', ip: '192.168.1.30' });
    expect(ritorno).toEqual(nuovaPresa);
    expect(result.current.prese).toEqual([nuovaPresa]);
  });

  test('aggiornaPresa: sostituisce solo la presa corrispondente nella lista', async () => {
    preseApi.getAll.mockResolvedValue([
      { presaId: 'presa1', nome: 'Frigo' },
      { presaId: 'presa2', nome: 'Lavatrice' },
    ]);
    preseApi.update.mockResolvedValue({ presaId: 'presa1', nome: 'Frigo nuovo' });

    const { result } = renderHook(() => usePrese());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.aggiornaPresa('presa1', { nome: 'Frigo nuovo' });
    });

    expect(result.current.prese).toEqual([
      { presaId: 'presa1', nome: 'Frigo nuovo' },
      { presaId: 'presa2', nome: 'Lavatrice' },
    ]);
  });

  test('rimuoviPresa: chiama preseApi.remove e toglie la presa dalla lista', async () => {
    preseApi.getAll.mockResolvedValue([
      { presaId: 'presa1', nome: 'Frigo' },
      { presaId: 'presa2', nome: 'Lavatrice' },
    ]);
    preseApi.remove.mockResolvedValue(null);

    const { result } = renderHook(() => usePrese());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.rimuoviPresa('presa1');
    });

    expect(preseApi.remove).toHaveBeenCalledWith('presa1');
    expect(result.current.prese).toEqual([{ presaId: 'presa2', nome: 'Lavatrice' }]);
  });

  test('inviaComando: aggiorna lo stato locale in modo ottimistico, senza rifare un fetch completo', async () => {
    preseApi.getAll.mockResolvedValue([{ presaId: 'presa1', nome: 'Frigo', stato: 'off' }]);
    preseApi.inviaComando.mockResolvedValue();

    const { result } = renderHook(() => usePrese());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.inviaComando('presa1', 'on');
    });

    expect(preseApi.inviaComando).toHaveBeenCalledWith('presa1', 'on');
    expect(result.current.prese[0].stato).toBe('on');
    expect(preseApi.getAll).toHaveBeenCalledTimes(1); // solo la chiamata iniziale, nessun refetch
  });

  test("se creaPresa fallisce, propaga l'errore e NON modifica la lista", async () => {
    preseApi.getAll.mockResolvedValue([]);
    preseApi.create.mockRejectedValue(new Error('presaId già registrato'));

    const { result } = renderHook(() => usePrese());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.creaPresa({ presaId: 'presa1' })).rejects.toThrow('presaId già registrato');
    });

    expect(result.current.prese).toEqual([]);
  });
});