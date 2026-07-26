import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../src/services/api/auth', () => ({ login: vi.fn() }));
vi.mock('../../../src/services/api/client', () => ({
  setAuthToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));


import * as authApi from '../../../src/services/api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../../../src/services/api/client';
import { AuthProvider, useAuth } from '../../../src/context/AuthContext';

const STORAGE_KEY = 'iot-energy:token';


describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test('senza token in localStorage, isAuthenticated parte false', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('con un token già in localStorage (reload di pagina), isAuthenticated parte true', () => {
    localStorage.setItem(STORAGE_KEY, 'token-esistente');

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isAuthenticated).toBe(true);
  });

  test('login: salva il token in localStorage, imposta isAuthenticated e chiama setAuthToken', async () => {
    authApi.login.mockResolvedValue({ token: 'nuovo-token' });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.login('admin', 'password-corretta');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('nuovo-token');
    expect(setAuthToken).toHaveBeenCalledWith('nuovo-token');
  });

  test('login fallito: propaga l\'errore e NON autentica né scrive su localStorage', async () => {
    authApi.login.mockRejectedValue(new Error('Credenziali non valide'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await expect(result.current.login('admin', 'sbagliata')).rejects.toThrow('Credenziali non valide');
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('logout: rimuove il token da localStorage, isAuthenticated torna false, chiama setAuthToken(null)', () => {
    localStorage.setItem(STORAGE_KEY, 'token-esistente');
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(setAuthToken).toHaveBeenCalledWith(null);
  });

  test('registra logout come handler di unauthorized al mount (un 401 altrove causa logout automatico)', () => {
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(setUnauthorizedHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  test('useAuth usato fuori da AuthProvider lancia un errore esplicito', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth deve essere usato dentro <AuthProvider>');
  });
});