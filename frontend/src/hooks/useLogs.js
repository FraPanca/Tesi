import { useState, useEffect, useCallback } from 'react';
import * as logsApi from '../services/api/logs';


function useLogs({ evento, livello, origine, da, a, limite } = {}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ricarica = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await logsApi.getLogs({ evento, livello, origine, da, a, limite }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [evento, livello, origine, da, a, limite]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  return { logs, loading, error, ricarica };
}


export default useLogs;