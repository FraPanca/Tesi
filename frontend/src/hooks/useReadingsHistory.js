import { useState, useEffect, useCallback } from 'react';
import * as consumiApi from '../services/api/consumi';
import { useWebSocket } from '../context/WebSocketContext';

/**
 * Storico letture di UNA presa, filtrabile per periodo (da/a).
 * Usa sempre: GET /api/consumi/:presaId
 *
 * @param {string} presaId
 * @param {{ da?: string, a?: string }} periodo - assente/undefined = storico completo
 */
function useReadingsHistory(presaId, { da, a } = {}) {
  const [letture, setLetture] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { subscribe } = useWebSocket();

  const ricarica = useCallback(async () => {
    if (!presaId) {
      setLetture([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setLetture(await consumiApi.getStorico(presaId, { da, a }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [presaId, da, a]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  useEffect(() => {
    if (!presaId) return undefined;

    return subscribe(presaId, (dato) => {
      // Accodiamo il dato live SOLO se non c'è un limite superiore esplicito (`a`): il grafico è a tutti gli effetti una vista live.
      if (a) return;
      setLetture((prev) => [...prev, dato]);
    });
  }, [presaId, a, subscribe]);

  return { letture, loading, error, ricarica };
}


export default useReadingsHistory;