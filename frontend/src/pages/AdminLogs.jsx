import { useState } from 'react';
import useLogs from '../hooks/useLogs';
import { useAuth } from '../context/AuthContext';
import LogTable from '../components/LogTable';
import AdminDiagnostics from '../components/AdminDiagnostics';
import '../style/AdminLogs.css';


function AdminLogs() {
  const { logout } = useAuth();
  const [filtri, setFiltri] = useState({
    evento: '',
    livello: '',
    origine: '',
    da: '',
    a: '',
    limite: 100,
  });

  const { logs, loading, error } = useLogs(filtri);

  function aggiornaFiltro(campo, valore) {
    setFiltri((prev) => ({ ...prev, [campo]: valore }));
  }

  return (
    <div className="admin-logs">
      <header className="admin-logs__intestazione">
        <h1>Log di sistema</h1>
        <button type="button" className="btn" onClick={logout}>
          Esci
        </button>
      </header>

      <section className="card admin-logs__filtri">
        <label>
          Evento
          <input
            value={filtri.evento}
            onChange={(e) => aggiornaFiltro('evento', e.target.value)}
            placeholder="es. auth.login"
          />
        </label>
        <label>
          Livello
          <select value={filtri.livello} onChange={(e) => aggiornaFiltro('livello', e.target.value)}>
            <option value="">Tutti</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </label>
        <label>
          Origine
          <select value={filtri.origine} onChange={(e) => aggiornaFiltro('origine', e.target.value)}>
            <option value="">Tutte</option>
            <option value="admin">Admin</option>
            <option value="sistema">Sistema</option>
          </select>
        </label>
        <label>
          Da
          <input type="date" value={filtri.da} onChange={(e) => aggiornaFiltro('da', e.target.value)} />
        </label>
        <label>
          A
          <input type="date" value={filtri.a} onChange={(e) => aggiornaFiltro('a', e.target.value)} />
        </label>
        <label>
          Limite
          <input
            type="number"
            min="1"
            max="500"
            value={filtri.limite}
            onChange={(e) => aggiornaFiltro('limite', Number(e.target.value))}
          />
        </label>
      </section>

      {error && <p className="admin-logs__errore">Errore nel caricamento dei log: {error}</p>}

      <LogTable logs={logs} loading={loading} />

      <AdminDiagnostics />
    </div>
  );
}


export default AdminLogs;