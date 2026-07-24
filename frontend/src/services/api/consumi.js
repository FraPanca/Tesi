import { apiFetch } from './client';

// GET /api/consumi/:presaId?da=&a= (nessun auth richiesto, ordine cronologico crescente).
function getStorico(presaId, { da, a } = {}) {
  const params = new URLSearchParams();
  if (da) params.set('da', da);
  if (a) params.set('a', a);
  const query = params.toString() ? `?${params}` : '';
  return apiFetch(`/api/consumi/${presaId}${query}`);
}

// GET /api/consumi/:presaId/recenti (ultimi 20 valori da Redis, ordine dal più recente)
function getRecenti(presaId) {
  return apiFetch(`/api/consumi/${presaId}/recenti`);
}


export { getStorico, getRecenti };