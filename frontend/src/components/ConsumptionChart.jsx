import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import '../style/ConsumptionChart.css';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

const SERIE = {
  potenza: { etichetta: 'Potenza', unita: 'W', colore: '#8a5a2e', chiave: 'potenza' },
  tensione: { etichetta: 'Tensione', unita: 'V', colore: '#5c7a2e', chiave: 'tensione' },
  corrente: { etichetta: 'Corrente', unita: 'A', colore: '#2f6690', chiave: 'corrente' },
};
const COLORE_ASSE = '#4a5a54';
const COLORE_GRIGLIA = '#dce1e0';


// Grafico dei consumi per UNA presa. Potenza (decine/centinaia di W), tensione (~230V) e corrente (<1A tipicamente)
// hanno scale di valori troppo diverse per condividere lo stesso asse in modo leggibile.
function ConsumptionChart({ letture, loading }) {
  const [serieAttiva, setSerieAttiva] = useState('potenza');
  const config = SERIE[serieAttiva];

  const dati = useMemo(
    () => ({
      labels: letture.map((l) =>
        new Date(l.timestamp).toLocaleString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      ),
      datasets: [
        {
          label: `${config.etichetta} (${config.unita})`,
          data: letture.map((l) => l[config.chiave]),
          borderColor: config.colore,
          backgroundColor: config.colore,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }),
    [letture, config],
  );

  const opzioni = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} ${config.unita}` } },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 8, color: COLORE_ASSE }, grid: { display: false } },
      y: { ticks: { color: COLORE_ASSE }, grid: { color: COLORE_GRIGLIA } },
    },
  };

  return (
    <div className="consumption-chart">
      <div className="consumption-chart__tabs" role="tablist" aria-label="Grandezza mostrata">
        {Object.entries(SERIE).map(([chiave, s]) => (
          <button
            key={chiave}
            type="button"
            role="tab"
            aria-selected={serieAttiva === chiave}
            className={`consumption-chart__tab ${serieAttiva === chiave ? 'is-active' : ''}`}
            style={{ '--tab-colore': s.colore }}
            onClick={() => setSerieAttiva(chiave)}
          >
            {s.unita}
          </button>
        ))}
      </div>

      <div className="consumption-chart__area">
        {loading && <p className="consumption-chart__stato">Caricamento…</p>}
        {!loading && letture.length === 0 && (
          <p className="consumption-chart__stato">Nessun dato per il periodo selezionato.</p>
        )}
        {!loading && letture.length > 0 && <Line data={dati} options={opzioni} />}
      </div>
    </div>
  );
}


export default ConsumptionChart;