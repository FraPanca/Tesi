const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Token corrente, impostato da AuthContext ad ogni login/logout.
let authToken = null;
function setAuthToken(token) {
  authToken = token;
}

// Callback impostata da AuthContext al mount: permette a questo modulo di reagire a un 401 (token scaduto/non valido)
// senza che ogni singolo hook debba gestire il logout autonomamente.
let onUnauthorized = () => {};
function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/**
 * @param {string} path - es. '/api/prese'
 * @param {object} opts
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [opts.method]
 * @param {object} [opts.body]
 * @param {boolean} [opts.auth] - true per gli endpoint protetti (/api/admin/*, /api/logs)
 */
async function apiFetch(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content (es. DELETE /api/prese/:presaId): niente body da leggere.
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized();
    throw new ApiError(data?.errore || `Errore ${res.status}`, res.status);
  }

  return data;
}


export { apiFetch, setAuthToken, setUnauthorizedHandler, ApiError };