import { apiFetch } from './client';

// GET /api/prese (nessun auth richiesto) 
function getAll() {
  return apiFetch('/api/prese');
}

// GET /api/prese/:presaId (404 se non esiste)
function getOne(presaId) {
  return apiFetch(`/api/prese/${presaId}`);
}

// POST /api/prese  body: { presaId, nome, ip, sogliaPotenza? } (409 se presaId o ip già in uso)
function create({ presaId, nome, ip, sogliaPotenza }) {
  return apiFetch('/api/prese', {
    method: 'POST',
    body: { presaId, nome, ip, sogliaPotenza },
  });
}

// PATCH /api/prese/:presaId  body: { nome?, sogliaPotenza? }
function update(presaId, { nome, sogliaPotenza } = {}) {
  const body = {};
  if (nome !== undefined) body.nome = nome;
  if (sogliaPotenza !== undefined) body.sogliaPotenza = sogliaPotenza;
  return apiFetch(`/api/prese/${presaId}`, { method: 'PATCH', body });
}

// DELETE /api/prese/:presaId (204, nessun body)
function remove(presaId) {
  return apiFetch(`/api/prese/${presaId}`, { method: 'DELETE' });
}

// POST /api/prese/:presaId/comando  body: { azione: 'on' | 'off' }
function inviaComando(presaId, azione) {
  return apiFetch(`/api/prese/${presaId}/comando`, {
    method: 'POST',
    body: { azione },
  });
}


export { getAll, getOne, create, update, remove, inviaComando };