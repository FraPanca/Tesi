import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useNow from '../../../src/hooks/useNow';


describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('al mount restituisce la data corrente', () => {
    const { result } = renderHook(() => useNow());

    expect(result.current).toEqual(new Date('2026-07-20T10:00:00.000Z'));
  });

  test('dopo aver avanzato il tempo finto di intervalMs (default 60000), il valore si aggiorna', () => {
    const { result } = renderHook(() => useNow());

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toEqual(new Date('2026-07-20T10:01:00.000Z'));
  });

  test('rispetta un intervalMs personalizzato', () => {
    const { result } = renderHook(() => useNow(5_000));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current).toEqual(new Date('2026-07-20T10:00:05.000Z'));
  });

  test('non si aggiorna prima che intervalMs sia trascorso', () => {
    const { result } = renderHook(() => useNow());
    const valoreIniziale = result.current;

    act(() => {
      vi.advanceTimersByTime(59_999);
    });

    expect(result.current).toEqual(valoreIniziale);
  });

  test('allo smontaggio pulisce il timer (nessun timer residuo)', () => {
    const { unmount } = renderHook(() => useNow());

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});