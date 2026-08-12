import numpy as np
import pandas as pd

from models.anomaly_detection import SOGLIA_PUNTI_MINIMI, rileva_anomalie


def _serie_regolare(n_ore, potenza_base=50.0, seme=42):
    # Pattern sintetico regolare: potenza base + piccolo rumore, nessuna anomalia.
    rng = np.random.default_rng(seme)
    indice = pd.date_range("2026-08-01T00:00:00", periods=n_ore, freq="h", tz="Europe/Rome")
    rumore = rng.normal(0, 1.0, n_ore)
    return pd.DataFrame({"ds": indice, "y": potenza_base + rumore})


class TestSogliaPuntiMinimi:
    def test_sotto_soglia_ritorna_vuoto_senza_addestrare_un_modello(self):
        serie = _serie_regolare(SOGLIA_PUNTI_MINIMI - 1)

        risultato = rileva_anomalie(serie)

        assert risultato.empty

    def test_il_risultato_vuoto_ha_comunque_la_colonna_punteggio(self):
        serie = _serie_regolare(SOGLIA_PUNTI_MINIMI - 1)

        risultato = rileva_anomalie(serie)

        assert "punteggio" in risultato.columns

    def test_esattamente_alla_soglia_procede_con_il_rilevamento(self):
        serie = _serie_regolare(SOGLIA_PUNTI_MINIMI)

        # Non deve sollevare eccezioni e deve ritornare un DataFrame (anche se vuoto per assenza di anomalie reali).
        risultato = rileva_anomalie(serie)
        assert "punteggio" in risultato.columns


class TestRilevamentoEOrdinamento:
    def test_rileva_le_anomalie_iniettate_in_un_pattern_regolare_e_le_ordina_dal_piu_anomalo(self):
        serie = _serie_regolare(500, potenza_base=50.0)

        # Inietta due anomalie nette, di intensità diversa, in momenti "innocui" (notte) per massimizzare
        # la distanza dal pattern atteso a quell'ora.
        indice_anomalia_forte = 100
        indice_anomalia_debole = 250
        serie.loc[indice_anomalia_forte, "y"] = 500.0  # molto più marcata
        serie.loc[indice_anomalia_debole, "y"] = 150.0  # marcata ma meno

        risultato = rileva_anomalie(serie)

        assert not risultato.empty
        ds_anomalia_forte = serie.loc[indice_anomalia_forte, "ds"]
        ds_anomalia_debole = serie.loc[indice_anomalia_debole, "ds"]

        assert ds_anomalia_forte in risultato["ds"].tolist()
        assert ds_anomalia_debole in risultato["ds"].tolist()

        # Ordinato dal punteggio più negativo (più anomalo) in poi: l'anomalia più marcata deve comparire prima.
        posizione_forte = risultato.index[risultato["ds"] == ds_anomalia_forte][0]
        posizione_debole = risultato.index[risultato["ds"] == ds_anomalia_debole][0]
        punteggio_forte = risultato.loc[posizione_forte, "punteggio"]
        punteggio_debole = risultato.loc[posizione_debole, "punteggio"]
        assert punteggio_forte < punteggio_debole  # più negativo = più anomalo

        indice_riga_forte = risultato.index.get_loc(posizione_forte)
        indice_riga_debole = risultato.index.get_loc(posizione_debole)
        assert indice_riga_forte < indice_riga_debole

    def test_il_risultato_e_ordinato_per_punteggio_crescente_dal_piu_negativo(self):
        serie = _serie_regolare(500, potenza_base=50.0)
        serie.loc[50, "y"] = 600.0
        serie.loc[150, "y"] = 550.0
        serie.loc[300, "y"] = 500.0

        risultato = rileva_anomalie(serie)

        punteggi = risultato["punteggio"].tolist()
        assert punteggi == sorted(punteggi)