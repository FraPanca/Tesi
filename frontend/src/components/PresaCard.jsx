import { useState } from 'react';
import { Link } from 'react-router-dom';
import useRecentReadings from '../hooks/useRecentReadings';
import '../style/PresaCard.css';


function PresaCard({ presa, onComando, onRimuovi }) {
  const { letture } = useRecentReadings(presa.presaId);
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [errore, setErrore] = useState(null);

  const ultimaLettura = letture[0]; // useRecentReadings: ordine dal più recente
  const potenza = ultimaLettura ? ultimaLettura.potenza : null;
  const acceso = presa.stato === 'on';

  async function gestisciComando(azione) {
    setInvioInCorso(true);
    setErrore(null);
    try {
      await onComando(presa.presaId, azione);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvioInCorso(false);
    }
  }

  return (
    <article className={`card presa-card ${acceso ? 'is-on' : ''}`}>
      <button
        className="presa-card__rimuovi"
        onClick={() => onRimuovi(presa.presaId)}
        aria-label={`Rimuovi ${presa.nome}`}
        title="Rimuovi presa"
      >
        ✕
      </button>

      <header className="presa-card__intestazione">
        <span
          className={`presa-card__pallino ${acceso ? 'presa-card__pallino--pulse' : ''}`}
          aria-hidden="true"
        />
        <Link to={`/prese/${presa.presaId}`} className="presa-card__nome">
          {presa.nome}
        </Link>
      </header>

      <div className="presa-card__display">
        <span className="presa-card__valore">{potenza !== null ? potenza.toFixed(1) : '––.–'}</span>
        <span className="presa-card__unita">W</span>
      </div>

      {presa.sogliaPotenza != null && (
        <p className="presa-card__soglia">Spegnimento automatico oltre {presa.sogliaPotenza} W</p>
      )}

      <div className="presa-card__azioni">
        <button
          type="button"
          className="btn presa-card__bottone--on"
          disabled={invioInCorso || acceso}
          onClick={() => gestisciComando('on')}
        >
          ON
        </button>
        <button
          type="button"
          className="btn presa-card__bottone--off"
          disabled={invioInCorso || !acceso}
          onClick={() => gestisciComando('off')}
        >
          OFF
        </button>
      </div>

      {invioInCorso && <p className="presa-card__stato-invio">Invio comando… (può richiedere qualche secondo)</p>}
      {errore && <p className="presa-card__errore">{errore}</p>}
    </article>
  );
}


export default PresaCard;