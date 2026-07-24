import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as authApi from '../services/api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../services/api/client';

const STORAGE_KEY = 'iot-energy:token';

// Un solo livello di autorizzazione nel sistema: chi ha un token valido è l'amministratore.
const AuthContext = createContext(null);


export function AuthProvider({ children }) {
  // Lazy initializer: legge il token da localStorage così un reload della pagina non fa perdere la sessione.
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Registrata una sola volta: qualunque chiamata autenticata che riceve 401 (token scaduto o non valido) causa un logout automatico.
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const { token: nuovoToken } = await authApi.login(username, password);
    setToken(nuovoToken);
    localStorage.setItem(STORAGE_KEY, nuovoToken);
  }, []);

  // useMemo evita di ricreare l'oggetto value ad ogni render di un componente qualsiasi dell'app.
  const value = useMemo(
    () => ({ isAuthenticated: Boolean(token), login, logout }),
    [token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}