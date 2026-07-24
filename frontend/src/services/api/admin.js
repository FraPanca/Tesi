import { apiFetch } from './client';

// POST /api/admin/flush (protetto, blocca la risposta per ~8s, che è la finestra di ascolto fissa lato backend).
function flush() {
  return apiFetch('/api/admin/flush', { method: 'POST', auth: true });
}

// POST /api/admin/healthcheck (protetto, blocca ~5s).
function healthcheck() {
  return apiFetch('/api/admin/healthcheck', { method: 'POST', auth: true });
}


export { flush, healthcheck };