import '../style/AnomalieList.css';

// Europe/Rome esplicito: i timestamp arrivano sempre in UTC, la conversione a orario locale resta a carico di chi li mostra.
function formattaData(ds) {
  return new Date(ds).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  });
}

function AnomalieList({ anomalie }) {
  const ordinate = [...anomalie].sort((a, b) => new Date(b.ds) - new Date(a.ds));

  return (
    <div>
      <ul className="anomalie-list">
        {ordinate.map((a) => (
          <li key={a.ds} className="anomalie-list__voce">
            <span className="anomalie-list__data">{formattaData(a.ds)}</span>
            <span className="anomalie-list__valore">{a.y.toFixed(1)} W</span>
            <span className="anomalie-list__punteggio">{a.punteggio.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p className="anomalie-list__nota">Punteggio: più negativo indica un'anomalia più marcata.</p>
    </div>
  );
}


export default AnomalieList;