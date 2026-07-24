import '../style/AdminLogs.css';

const ETICHETTA_LIVELLO = { info: 'Info', warn: 'Warn', error: 'Error' };


function LogTable({ logs, loading }) {
  if (loading) return <p className="log-table__stato">Caricamento…</p>;
  if (logs.length === 0) return <p className="log-table__stato">Nessun log trovato per questi filtri.</p>;

  return (
    <div className="log-table-wrapper">
      <table className="log-table">
        <thead>
          <tr>
            <th>Quando</th>
            <th>Livello</th>
            <th>Origine</th>
            <th>Evento</th>
            <th>Messaggio</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log._id} className="log-table__riga">
              <td>{new Date(log.timestamp).toLocaleString('it-IT')}</td>
              <td>
                <span className={`log-table__badge log-table__badge--${log.livello}`}>
                  {ETICHETTA_LIVELLO[log.livello]}
                </span>
              </td>
              <td>{log.origine}</td>
              <td>{log.evento}</td>
              <td>{log.messaggio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default LogTable;