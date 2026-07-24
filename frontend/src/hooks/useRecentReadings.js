import { useState, useEffect, useCallback } from 'react';
import * as consumiApi from '../services/api/consumi';
import { useWebSocket } from '../context/WebSocketContext';


function useRecentReadings(presaId) {
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
      setLetture(await consumiApi.getRecenti(presaId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [presaId]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  useEffect(() => {
    if (!presaId) return undefined;

    return subscribe(presaId, (dato) => {
      // Stessa logica della lista fissa a 20 elementi mantenuta lato backend in Redis.
      setLetture((prev) => [dato, ...prev].slice(0, 20));
    });
  }, [presaId, subscribe]);

  return { letture, loading, error, ricarica };
}


export default useRecentReadings;