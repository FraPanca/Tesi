import { useMemo, useState } from 'react';
import '../style/DashboardWidgets.css';


// Integra la potenza (W) nel tempo con il metodo dei trapezi tra letture consecutive e converte in kWh.
function stimaEnergiaKWh(letture) {
  if (letture.length < 2) return 0;
  let whTotali = 0;
  for (let i = 1; i < letture.length; i += 1) {
    const prec = letture[i - 1];
    const att = letture[i];
    const deltaOre = (new Date(att.timestamp) - new Date(prec.timestamp)) / 3_600_000;
    if (deltaOre <= 0) continue; // ignora eventuali timestamp fuori ordine
    whTotali += ((prec.potenza + att.potenza) / 2) * deltaOre;
  }
  return whTotali / 1000;
}

function CostEstimator({ letture }) {
  const [tariffa, setTariffa] = useState('');

  const energiaKWh = useMemo(() => stimaEnergiaKWh(letture), [letture]);
  const tariffaNum = parseFloat(tariffa.replace(',', '.'));
  const costo = Number.isFinite(tariffaNum) ? energiaKWh * tariffaNum : null;

  return (
    <div className="card cost-estimator">
      <h3>Stima costo periodo</h3>
      <p className="cost-estimator__energia">
        Energia stimata: <strong>{energiaKWh.toFixed(2)} kWh</strong>
      </p>
      <label className="cost-estimator__campo">
        Tariffa (€/kWh)
        <input
          type="text"
          inputMode="decimal"
          placeholder="es. 0,25"
          value={tariffa}
          onChange={(e) => setTariffa(e.target.value)}
        />
      </label>
      {costo !== null && (
        <p className="cost-estimator__totale">
          Costo stimato: <strong>€ {costo.toFixed(2)}</strong>
        </p>
      )}
      <p className="cost-estimator__nota">Stima calcolata dal campionamento disponibile, non una misura esatta.</p>
    </div>
  );
}


export default CostEstimator;