import { useState, useEffect, useCallback } from 'react';
import * as previsioniApi from '../services/api/previsioni';
import { ApiError } from '../services/api/client';

// 30h, non 24h: margine di tolleranza sul job notturno per non trattare come "assente" una previsione leggermente in ritardo.
const SOGLIA_FRESCHEZZA_MS = 30 * 60 * 60 * 1000;


function usePrevisione(presaId) {
  const [previsione, setPrevisione] = useState(null);
  const [stato, setStato] = useState('loading'); // 'loading' | 'disponibile' | 'assente' | 'errore'
  const [error, setError] = useState(null);

  const ricarica = useCallback(async () => {
    if (!presaId) {
      setStato('assente');
      return;
    }
    setStato('loading');
    setError(null);
    try {
      const dati = await previsioniApi.getUltima(presaId);
      const eta = Date.now() - new Date(dati.generatoIl).getTime();
      if (eta > SOGLIA_FRESCHEZZA_MS) {
        setPrevisione(null);
        setStato('assente');
      } else {
        setPrevisione(dati);
        setStato('disponibile');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setPrevisione(null);
        setStato('assente');
      } else {
        setError(err.message);
        setStato('errore');
      }
    }
  }, [presaId]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  return { previsione, stato, error, ricarica };
}


export default usePrevisione;