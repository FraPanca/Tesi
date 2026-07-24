import { apiFetch } from './client';

// GET /api/logs?evento=&livello=&origine=&da=&a=&limite= (protetto, tutti i parametri opzionali).
// Livello non valido (fuori da info|warn|error) o origine non valida (fuori da admin|sistema) → 400.
// Limite: default 100, tetto 500 (valori più alti vengono silenziosamente ridotti, nessun errore).
function getLogs({ evento, livello, origine, da, a, limite } = {}) {
  const params = new URLSearchParams();
  if (evento) params.set('evento', evento);
  if (livello) params.set('livello', livello);
  if (origine) params.set('origine', origine);
  if (da) params.set('da', da);
  if (a) params.set('a', a);
  if (limite) params.set('limite', limite);
  const query = params.toString() ? `?${params}` : '';
  return apiFetch(`/api/logs${query}`, { auth: true });
}


export { getLogs };