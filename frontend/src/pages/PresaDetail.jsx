import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import usePrese from '../hooks/usePrese';
import useReadingsHistory from '../hooks/useReadingsHistory';
import ConsumptionChart from '../components/ConsumptionChart';
import '../style/PresaDetail.css';

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

function PresaDetail() {
  const { presaId } = useParams();
  const navigate = useNavigate();
  const { prese, loading, aggiornaPresa, rimuoviPresa, inviaComando } = usePrese();

  const [periodo, setPeriodo] = useState('7g');
  const [modificaAperta, setModificaAperta] = useState(false);
  const [nome, setNome] = useState('');
  const [sogliaPotenza, setSogliaPotenza] = useState('');
  const [invioModificaInCorso, setInvioModificaInCorso] = useState(false);
  const [erroreModifica, setErroreModifica] = useState(null);
  const [invioComandoInCorso, setInvioComandoInCorso] = useState(false);
  const [erroreComando, setErroreComando] = useState(null);

  const presa = prese.find((p) => p.presaId === presaId);
  const da = useMemo(() => calcolaDa(PERIODI[periodo].giorni), [periodo]);
  const { letture, loading: letturaLoading } = useReadingsHistory(presaId, { da });

  if (loading) return <p className="presa-detail__stato">Caricamento…</p>;

  if (!presa) {
    return (
      <div className="presa-detail__stato">
        <p>Presa non trovata.</p>
        <Link to="/">Torna alla dashboard</Link>
      </div>
    );
  }

  const acceso = presa.stato === 'on';

  async function gestisciComando(azione) {
    setInvioComandoInCorso(true);
    setErroreComando(null);
    try {
      await inviaComando(presaId, azione);
    } catch (err) {
      setErroreComando(err.message);
    } finally {
      setInvioComandoInCorso(false);
    }
  }

  function apriModifica() {
    setNome(presa.nome);
    setSogliaPotenza(presa.sogliaPotenza != null ? String(presa.sogliaPotenza) : '');
    setErroreModifica(null);
    setModificaAperta(true);
  }

  async function gestisciSalvaModifica(e) {
    e.preventDefault();
    setInvioModificaInCorso(true);
    setErroreModifica(null);
    try {
      await aggiornaPresa(presaId, {
        nome: nome.trim(),
        sogliaPotenza: sogliaPotenza ? Number(sogliaPotenza) : null,
      });
      setModificaAperta(false);
    } catch (err) {
      setErroreModifica(err.message);
    } finally {
      setInvioModificaInCorso(false);
    }
  }

  async function gestisciRimozione() {
    if (!window.confirm("Rimuovere questa presa? L'azione non è reversibile.")) return;
    await rimuoviPresa(presaId);
    navigate('/', { replace: true });
  }

  return (
    <div className="presa-detail">
      <Link to="/" className="presa-detail__indietro">
        ← Dashboard
      </Link>

      <header className="presa-detail__intestazione">
        <div className="presa-detail__titolo">
          <span className={`presa-detail__pallino ${acceso ? 'is-on' : ''}`} aria-hidden="true" />
          <h1>{presa.nome}</h1>
        </div>
        <div className="presa-detail__azioni-intestazione">
          <button type="button" className="btn" onClick={apriModifica}>
            Modifica
          </button>
          <button type="button" className="btn" onClick={gestisciRimozione}>
            Rimuovi
          </button>
        </div>
      </header>

      <p className="presa-detail__meta">
        IP {presa.ip} · presaId {presa.presaId}
      </p>

      <div className="presa-detail__comando">
        <button
          type="button"
          className="btn presa-detail__bottone-on"
          disabled={invioComandoInCorso || acceso}
          onClick={() => gestisciComando('on')}
        >
          Accendi
        </button>
        <button
          type="button"
          className="btn presa-detail__bottone-off"
          disabled={invioComandoInCorso || !acceso}
          onClick={() => gestisciComando('off')}
        >
          Spegni
        </button>
        {invioComandoInCorso && (
          <span className="presa-detail__nota">Invio comando… (fino a qualche secondo)</span>
        )}
      </div>
      {erroreComando && <p className="presa-detail__errore">{erroreComando}</p>}

      {modificaAperta && (
        <form className="card presa-detail__form-modifica" onSubmit={gestisciSalvaModifica}>
          <label>
            Nome
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            Soglia potenza in W (vuoto = nessuno spegnimento automatico)
            <input
              type="number"
              min="0"
              value={sogliaPotenza}
              onChange={(e) => setSogliaPotenza(e.target.value)}
            />
          </label>
          {erroreModifica && <p className="presa-detail__errore">{erroreModifica}</p>}
          <div className="presa-detail__form-azioni">
            <button
              type="button"
              className="btn"
              onClick={() => setModificaAperta(false)}
              disabled={invioModificaInCorso}
            >
              Annulla
            </button>
            <button type="submit" className="btn btn--primary" disabled={invioModificaInCorso}>
              {invioModificaInCorso ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      )}

      <section className="card presa-detail__grafico">
        <div className="presa-detail__periodo" role="group" aria-label="Periodo">
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
        <ConsumptionChart letture={letture} loading={letturaLoading} />
      </section>
    </div>
  );
}


export default PresaDetail;