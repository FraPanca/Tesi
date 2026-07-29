import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { it } from 'date-fns/locale';
import { Line } from 'react-chartjs-2';
import useNow from '../hooks/useNow';
import '../style/ConsumptionChart.css';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend);


const SERIE = {
  potenza: { etichetta: 'Potenza', unita: 'W', colore: '#8a5a2e', chiave: 'potenza' },
  tensione: { etichetta: 'Tensione', unita: 'V', colore: '#5c7a2e', chiave: 'tensione' },
  corrente: { etichetta: 'Corrente', unita: 'A', colore: '#2f6690', chiave: 'corrente' },
};
const COLORE_ASSE = '#4a5a54';
const COLORE_GRIGLIA = '#dce1e0';


// Grafico dei consumi per UNA presa. Potenza (decine/centinaia di W), tensione (~230V) e corrente (<1A tipicamente)
// hanno scale di valori troppo diverse per condividere lo stesso asse in modo leggibile.

// Asse X a scala temporale (`type: 'time'`), non a categorie: le letture NON arrivano a intervalli regolari (dipende da quando
// ESP32/gateway pubblicano), quindi uno spaziamento "a slot uguali" tra i punti darebbe una rappresentazione fuorviante.
function ConsumptionChart({ letture, loading, periodo = '7g' }) {
  const [serieAttiva, setSerieAttiva] = useState('potenza');
  const config = SERIE[serieAttiva];
  const now = useNow(60_000);
  // "minUnit", non "unit": lascia comunque a Chart.js la libertà di passare a un'unità più grande quando serve.
  const minUnit = periodo === '24h' ? 'hour' : 'day';

  const dati = useMemo(() => {
    const ordinate = [...letture].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const punti = ordinate.map((l) => ({ x: new Date(l.timestamp), y: l[config.chiave] }));

    // Distende l'ultimo valore noto fino ad "ora" con un punto sintetico (non una lettura reale).
    const ultimo = punti[punti.length - 1];
    if (ultimo && now.getTime() > ultimo.x.getTime()) {
      punti.push({ x: now, y: ultimo.y });
    }

    return {
      datasets: [
        {
          label: `${config.etichetta} (${config.unita})`,
          data: punti,
          borderColor: config.colore,
          backgroundColor: config.colore,
          cubicInterpolationMode: 'monotone',
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [letture, config, now]);

  const opzioni = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.formattedValue} ${config.unita}` },
      },
    },
    scales: {
      x: {
        type: 'time',
        adapters: { date: { locale: it } },
        time: {
          minUnit,
          tooltipFormat: 'd MMM yyyy, HH:mm',
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'd MMM',
            week: 'd MMM',
            month: 'MMM yyyy',
          },
        },
        ticks: { maxTicksLimit: 8, color: COLORE_ASSE },
        grid: { display: false },
      },
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