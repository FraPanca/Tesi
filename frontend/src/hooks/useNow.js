import { useEffect, useState } from 'react';


//Restituisce un oggetto Date aggiornato ogni `intervalMs` millisecondi.
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}


export default useNow;