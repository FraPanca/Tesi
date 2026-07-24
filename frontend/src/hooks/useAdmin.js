import { useState, useCallback } from 'react';
import * as adminApi from '../services/api/admin';


// Flush e healthcheck sono azioni on-demand (bottone premuto dall'admin), non dati da caricare
// al mount come negli altri hook; per questo qui non c'è nessun useEffect.
function useAdmin() {
  const [flushInCorso, setFlushInCorso] = useState(false);
  const [flushRisultato, setFlushRisultato] = useState(null);
  const [flushErrore, setFlushErrore] = useState(null);

  const [healthInCorso, setHealthInCorso] = useState(false);
  const [healthRisultato, setHealthRisultato] = useState(null);
  const [healthErrore, setHealthErrore] = useState(null);

  const eseguiFlush = useCallback(async () => {
    setFlushInCorso(true);
    setFlushErrore(null);
    try {
      setFlushRisultato(await adminApi.flush());
    } catch (err) {
      setFlushErrore(err.message);
    } finally {
      setFlushInCorso(false);
    }
  }, []);

  const eseguiHealthcheck = useCallback(async () => {
    setHealthInCorso(true);
    setHealthErrore(null);
    try {
      setHealthRisultato(await adminApi.healthcheck());
    } catch (err) {
      setHealthErrore(err.message);
    } finally {
      setHealthInCorso(false);
    }
  }, []);

  return {
    flush: {
      esegui: eseguiFlush,
      inCorso: flushInCorso,
      risultato: flushRisultato,
      errore: flushErrore,
    },
    healthcheck: {
      esegui: eseguiHealthcheck,
      inCorso: healthInCorso,
      risultato: healthRisultato,
      errore: healthErrore,
    },
  };
}


export default useAdmin;