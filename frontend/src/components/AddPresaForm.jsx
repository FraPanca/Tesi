import { useState } from 'react';
import '../style/DashboardWidgets.css';


function AddPresaForm({ onCrea, onChiudi }) {
  const [form, setForm] = useState({ presaId: '', nome: '', ip: '', sogliaPotenza: '' });
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [errore, setErrore] = useState(null);

  function aggiornaCampo(campo, valore) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function gestisciSubmit(e) {
    e.preventDefault();
    setInvioInCorso(true);
    setErrore(null);
    try {
      await onCrea({
        presaId: form.presaId.trim(),
        nome: form.nome.trim(),
        ip: form.ip.trim(),
        sogliaPotenza: form.sogliaPotenza ? Number(form.sogliaPotenza) : null,
      });
      onChiudi();
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvioInCorso(false);
    }
  }

  return (
    <form className="card add-presa-form" onSubmit={gestisciSubmit}>
      <h3>Aggiungi presa</h3>

      <label>
        Identificativo (es. presa3)
        <input required value={form.presaId} onChange={(e) => aggiornaCampo('presaId', e.target.value)} />
      </label>

      <label>
        Nome
        <input required value={form.nome} onChange={(e) => aggiornaCampo('nome', e.target.value)} />
      </label>

      <label>
        Indirizzo IP
        <input
          required
          placeholder="192.168.1.180"
          value={form.ip}
          onChange={(e) => aggiornaCampo('ip', e.target.value)}
        />
      </label>

      <label>
        Soglia potenza in W (opzionale)
        <input
          type="number"
          min="0"
          value={form.sogliaPotenza}
          onChange={(e) => aggiornaCampo('sogliaPotenza', e.target.value)}
        />
      </label>

      {errore && <p className="add-presa-form__errore">{errore}</p>}

      <div className="add-presa-form__azioni">
        <button type="button" className="btn" onClick={onChiudi} disabled={invioInCorso}>
          Annulla
        </button>
        <button type="submit" className="btn btn--primary" disabled={invioInCorso}>
          {invioInCorso ? 'Aggiunta…' : 'Aggiungi'}
        </button>
      </div>
    </form>
  );
}


export default AddPresaForm;