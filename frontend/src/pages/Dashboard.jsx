import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePrese from '../hooks/usePrese';
import useReadingsHistory from '../hooks/useReadingsHistory';
import ConsumptionChart from '../components/ConsumptionChart';
import PresaCard from '../components/PresaCard';
import CostEstimator from '../components/CostEstimator';
import AddPresaForm from '../components/AddPresaForm';
import '../style/Dashboard.css';

const PERIODI = {
  '24h': { etichetta: '24 ore', giorni: 1 },
  '7g': { etichetta: '7 giorni', giorni: 7 },
  '30g': { etichetta: '30 giorni', giorni: 30 },
  tutto: { etichetta: 'Tutto', giorni: null },
};


function calcolaDa(giorni) {
  if (!giorni) return undefined;
  return new Date(Date.now() - giorni * 24 * 60 * 60 * 1000).toISOString();
}

function Dashboard() {
  const {
    prese,
    loading: preseLoading,
    error: preseError,
    creaPresa,
    rimuoviPresa,
    inviaComando,
  } = usePrese();

  const [presaSelezionata, setPresaSelezionata] = useState(null);
  const [periodo, setPeriodo] = useState('7g');
  const [formAperto, setFormAperto] = useState(false);

  // Se l'utente non ha ancora scelto esplicitamente una presa, si usa la prima disponibile come default.
  const presaIdCorrente = presaSelezionata || prese[0]?.presaId || null;
  const presaCorrente = prese.find((p) => p.presaId === presaIdCorrente);

  const da = useMemo(() => calcolaDa(PERIODI[periodo].giorni), [periodo]);
  const { letture, loading: letturaLoading } = useReadingsHistory(presaIdCorrente, { da });

  async function gestisciRimozione(presaId) {
    if (!window.confirm("Rimuovere questa presa? L'azione non è reversibile.")) return;
    await rimuoviPresa(presaId);
    if (presaSelezionata === presaId) setPresaSelezionata(null);
  }

  return (
    <div className="dashboard">
      <header className="dashboard__intestazione">
        <div>
          <h1>Energia di casa</h1>
          <p className="dashboard__sottotitolo">Monitoraggio consumi in tempo reale</p>
        </div>
        <Link to="/admin/logs" className="btn dashboard__link-admin">
          Amministrazione
        </Link>
      </header>

      {preseError && <p className="dashboard__errore">Errore nel caricamento delle prese: {preseError}</p>}

      <section className="dashboard__filtri">
        <label className="dashboard__filtro-presa">
          Presa
          <select
            value={presaIdCorrente ?? ''}
            onChange={(e) => setPresaSelezionata(e.target.value)}
            disabled={prese.length === 0}
          >
            {prese.map((p) => (
              <option key={p.presaId} value={p.presaId}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        <div className="dashboard__periodo" role="group" aria-label="Periodo">
          {Object.entries(PERIODI).map(([chiave, p]) => (
            <button
              key={chiave}
              type="button"
              className={`btn ${periodo === chiave ? 'btn--primary' : ''}`}
              onClick={() => setPeriodo(chiave)}
            >
              {p.etichetta}
            </button>
          ))}
        </div>
      </section>

      <section className="card dashboard__grafico">
        {presaCorrente ? (
          <>
            <h2>{presaCorrente.nome}</h2>
            <ConsumptionChart letture={letture} loading={letturaLoading} />
          </>
        ) : (
          <p className="dashboard__vuoto">Aggiungi una presa per iniziare a vedere i consumi.</p>
        )}
      </section>

      <section className="dashboard__riga-secondaria">
        <CostEstimator letture={letture} />

        <div className="card dashboard__prese">
          <div className="dashboard__prese-intestazione">
            <h3>Le tue prese</h3>
            <button type="button" className="btn btn--primary" onClick={() => setFormAperto(true)}>
              + Aggiungi
            </button>
          </div>

          {preseLoading && <p>Caricamento…</p>}

          <div className="dashboard__griglia-prese">
            {prese.map((presa) => (
              <PresaCard key={presa.presaId} presa={presa} onComando={inviaComando} onRimuovi={gestisciRimozione} />
            ))}
          </div>

          {formAperto && <AddPresaForm onCrea={creaPresa} onChiudi={() => setFormAperto(false)} />}
        </div>
      </section>
    </div>
  );
}


export default Dashboard;