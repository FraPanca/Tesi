import { useState, useEffect, useCallback } from 'react';
import * as preseApi from '../services/api/prese';


// Gestisce l'intera lista delle prese.
function usePrese() {
  const [prese, setPrese] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ricarica = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrese(await preseApi.getAll());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    ricarica();
  }, [ricarica]);


  // Le funzioni sotto NON catturano il proprio errore in uno stato interno ma lo rilanciano.

  const creaPresa = useCallback(async (datiNuovaPresa) => {
    const creata = await preseApi.create(datiNuovaPresa);
    setPrese((prev) => [...prev, creata]);
    return creata;
  }, []);

  const aggiornaPresa = useCallback(async (presaId, modifiche) => {
    const aggiornata = await preseApi.update(presaId, modifiche);
    setPrese((prev) => prev.map((p) => (p.presaId === presaId ? aggiornata : p)));
    return aggiornata;
  }, []);

  const rimuoviPresa = useCallback(async (presaId) => {
    await preseApi.remove(presaId);
    setPrese((prev) => prev.filter((p) => p.presaId !== presaId));
  }, []);

  const inviaComando = useCallback(async (presaId, azione) => {
    await preseApi.inviaComando(presaId, azione);
    setPrese((prev) => prev.map((p) => (p.presaId === presaId ? { ...p, stato: azione } : p)));
  }, []);

  return { prese, loading, error, ricarica, creaPresa, aggiornaPresa, rimuoviPresa, inviaComando };
}


export default usePrese;