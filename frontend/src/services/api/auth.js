import { apiFetch } from './client';

// POST /api/auth/login (Risposta: { token }). Nessun endpoint di refresh: alla scadenza (12h) va rifatto il login.
function login(username, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}


export { login };