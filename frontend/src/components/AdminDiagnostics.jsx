import useAdmin from '../hooks/useAdmin';
import '../style/AdminLogs.css';

const ETICHETTA_COMPONENTE = {
  gateway: 'Gateway',
  esp32_load_balancer: 'ESP32 load balancer',
  esp32_worker1: 'ESP32 worker 1',
  esp32_worker2: 'ESP32 worker 2',
};


function AdminDiagnostics() {
  const { flush, healthcheck } = useAdmin();

  return (
    <section className="card admin-diagnostics">
      <h3>Diagnostica</h3>
      <p className="admin-diagnostics__nota">
        Verifiche dirette sulla pipeline hardware, non sui dati storici già salvati.
      </p>

      <div className="admin-diagnostics__blocco">
        <div className="admin-diagnostics__intestazione-blocco">
          <span>Pipeline dati (flush)</span>
          <button type="button" className="btn" onClick={flush.esegui} disabled={flush.inCorso}>
            {flush.inCorso ? 'In ascolto… (fino a 8s)' : 'Verifica'}
          </button>
        </div>

        {flush.errore && <p className="admin-diagnostics__errore">{flush.errore}</p>}

        {flush.risultato && flush.risultato.dati.length === 0 && (
          <p className="admin-diagnostics__vuoto">
            Nessuna lettura ricevuta nella finestra di ascolto. Può voler dire sia che la
            pubblicazione MQTT è fallita, sia che semplicemente non è arrivato nulla in tempo: la
            risposta del backend non distingue i due casi.
          </p>
        )}

        {flush.risultato && flush.risultato.dati.length > 0 && (
          <ul className="admin-diagnostics__letture">
            {flush.risultato.dati.map((d, i) => (
              <li key={`${d.presaId}-${d.timestamp}-${i}`}>
                <span className="admin-diagnostics__letture-presa">{d.presaId}</span>
                <span>{d.potenza.toFixed(1)} W</span>
                <span>{new Date(d.timestamp).toLocaleTimeString('it-IT')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-diagnostics__blocco">
        <div className="admin-diagnostics__intestazione-blocco">
          <span>Stato hardware (healthcheck)</span>
          <button type="button" className="btn" onClick={healthcheck.esegui} disabled={healthcheck.inCorso}>
            {healthcheck.inCorso ? 'In corso… (fino a 5s)' : 'Verifica'}
          </button>
        </div>

        {healthcheck.errore && <p className="admin-diagnostics__errore">{healthcheck.errore}</p>}

        {healthcheck.risultato && (
          <ul className="admin-diagnostics__stato-hardware">
            {Object.entries(healthcheck.risultato).map(([chiave, valore]) => (
              <li key={chiave}>
                <span>{ETICHETTA_COMPONENTE[chiave] || chiave}</span>
                <span
                  className={`admin-diagnostics__badge admin-diagnostics__badge--${
                    valore === 'OK' ? 'ok' : 'errore'
                  }`}
                >
                  {valore}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}


export default AdminDiagnostics;