import usePrevisione from '../hooks/usePrevisione';
import ForecastChart from './ForecastChart';
import AnomalieList from './AnomalieList';
import '../style/PrevisioniPanel.css';

// Le date arrivano sempre come ISO 8601 con timezone esplicito UTC.
const FORMATTATORE_GIORNO_LOCALE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' });


/**
 * Aggregazione giornaliera con MEDIA oraria, non somma: i 168 punti (7 giorni esatti da adesso) non sono
 * allineati ai confini di calendario, dove il primo e l'ultimo giorno del range sono quasi sempre parziali
 * (meno di 24 ore). Con la somma, un giorno parziale risulterebbe penalizzato solo perché ha meno ore, non
 * perché consuma meno: la media oraria confronta correttamente giorni con un numero diverso di punti.
 *
 * Il raggruppamento per giorno usa esplicitamente il fuso orario Europe/Rome (formattatore
 * sopra), non la sola porzione data della stringa UTC ricevuta.e.
 */
function aggregaPerGiorno(valoriPrevisti) {
  const perGiorno = new Map();
  valoriPrevisti.forEach((v) => {
    const dataUtc = new Date(v.ds);
    const chiaveGiorno = FORMATTATORE_GIORNO_LOCALE.format(dataUtc); // YYYY-MM-DD in Europe/Rome
    const voce = perGiorno.get(chiaveGiorno) || { data: dataUtc, totale: 0, conteggio: 0 };
    voce.totale += v.yhat;
    voce.conteggio += 1;
    perGiorno.set(chiaveGiorno, voce);
  });
  return [...perGiorno.values()]
    .map((v) => ({ data: v.data, mediaOraria: v.totale / v.conteggio }))
    .sort((a, b) => b.mediaOraria - a.mediaOraria);
}

function PrevisioniPanel({ presaId }) {
  const { previsione, stato, error } = usePrevisione(presaId);

  if (stato === 'loading') {
    return (
      <section className="card previsioni-panel">
        <h3>Previsioni</h3>
        <p className="previsioni-panel__stato">Caricamento…</p>
      </section>
    );
  }

  if (stato === 'errore') {
    return (
      <section className="card previsioni-panel">
        <h3>Previsioni</h3>
        <p className="previsioni-panel__errore">Errore nel caricamento delle previsioni: {error}</p>
      </section>
    );
  }

  if (stato === 'assente') {
    return (
      <section className="card previsioni-panel">
        <h3>Previsioni</h3>
        <p className="previsioni-panel__stato">Nessuna previsione disponibile per questa presa.</p>
      </section>
    );
  }

  const prossime24h = previsione.valoriPrevisti.slice(0, 24);
  const perGiorno = aggregaPerGiorno(previsione.valoriPrevisti);
  const giornoDiPicco = perGiorno[0];

  return (
    <section className="card previsioni-panel">
      <h3>Previsioni</h3>

      <div className="previsioni-panel__blocco">
        <h4>Prossime 24 ore</h4>
        <ForecastChart valoriPrevisti={prossime24h} />
      </div>

      {giornoDiPicco && (
        <p className="previsioni-panel__picco">
          Consumo previsto più alto:{' '}
          <strong>
            {giornoDiPicco.data.toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'Europe/Rome',
            })}
          </strong>{' '}
          (~{giornoDiPicco.mediaOraria.toFixed(0)} W medi orari)
        </p>
      )}

      {Array.isArray(previsione.suggerimenti) && previsione.suggerimenti.length > 0 && (
        <div className="previsioni-panel__blocco">
          <h4>Suggerimenti</h4>
          <ul className="previsioni-panel__suggerimenti">
            {previsione.suggerimenti.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {previsione.anomalie?.length > 0 && (
        <div className="previsioni-panel__blocco">
          <h4>Anomalie recenti</h4>
          <AnomalieList anomalie={previsione.anomalie} />
        </div>
      )}
    </section>
  );
}

export default PrevisioniPanel;