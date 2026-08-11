import { useMemo } from 'react';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { it } from 'date-fns/locale';
import { Line } from 'react-chartjs-2';
import '../style/ForecastChart.css';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler);

const COLORE_PREVISIONE = '#2f6690';
const COLORE_BANDA = 'rgba(47, 102, 144, 0.15)';
const COLORE_ASSE = '#4a5a54';
const COLORE_GRIGLIA = '#dce1e0';


// Banda di confidenza in Chart.js: tre dataset sovrapposti, non uno con opzioni speciali. Il primo (limite superiore)
// non ha fill; il secondo (limite inferiore) ha `fill: '-1'`, che lo riempie fino al dataset precedente per ottenere
// l'area colorata tra i due. Il terzo (yhat) è la sola linea visibile sopra la banda.
function ForecastChart({ valoriPrevisti }) {
  const dati = useMemo(
    () => ({
      datasets: [
        {
          label: 'Limite superiore',
          data: valoriPrevisti.map((v) => ({ x: new Date(v.ds), y: v.yhatUpper })),
          borderWidth: 0,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Limite inferiore',
          data: valoriPrevisti.map((v) => ({ x: new Date(v.ds), y: v.yhatLower })),
          borderWidth: 0,
          pointRadius: 0,
          backgroundColor: COLORE_BANDA,
          fill: '-1',
        },
        {
          label: 'Previsione',
          data: valoriPrevisti.map((v) => ({ x: new Date(v.ds), y: v.yhat })),
          borderColor: COLORE_PREVISIONE,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ],
    }),
    [valoriPrevisti],
  );

  const opzioni = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: (ctx) => ctx.dataset.label === 'Previsione',
        callbacks: { label: (ctx) => `${ctx.formattedValue} W (previsto)` },
      },
    },
    scales: {
      x: {
        type: 'time',
        adapters: { date: { locale: it } },
        time: { minUnit: 'hour', tooltipFormat: 'd MMM yyyy, HH:mm', displayFormats: { hour: 'HH:mm' } },
        ticks: { maxTicksLimit: 8, color: COLORE_ASSE },
        grid: { display: false },
      },
      y: { ticks: { color: COLORE_ASSE }, grid: { color: COLORE_GRIGLIA } },
    },
  };

  return (
    <div className="forecast-chart">
      <Line data={dati} options={opzioni} />
    </div>
  );
}


export default ForecastChart;