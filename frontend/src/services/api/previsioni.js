import { apiFetch } from './client';

// GET /api/previsioni/:presaId/ultima
// Nessun auth richiesto; 404 con { errore: "Nessuna previsione disponibile per questa presa" } è un esito normale,
// non un errore da propagare genericamente, gestito esplicitamente dal chiamante.
function getUltima(presaId) {
  return apiFetch(`/api/previsioni/${presaId}/ultima`);
}


export { getUltima };