import pandas as pd

from forecast.suggerimenti import (
    genera_suggerimenti_anomalie,
    genera_suggerimenti_soglia,
    genera_tutti_i_suggerimenti,
)


def _previsione(valori_per_giorno):
    """valori_per_giorno: lista di (data_iso, yhat) -> un punto orario per semplicità (aggregato = quel valore)."""
    righe = [{"ds": pd.Timestamp(data, tz="Europe/Rome"), "yhat": yhat} for data, yhat in valori_per_giorno]
    return pd.DataFrame(righe)


class TestGeneraSuggerimentiSoglia:
    def test_nessun_suggerimento_se_soglia_potenza_e_none(self):
        previsione = _previsione([("2026-08-11T12:00:00", 500)])

        assert genera_suggerimenti_soglia(previsione, None) == []

    def test_nessun_suggerimento_se_nessun_giorno_supera_la_soglia(self):
        previsione = _previsione([("2026-08-11T12:00:00", 100), ("2026-08-12T12:00:00", 150)])

        assert genera_suggerimenti_soglia(previsione, 300) == []

    def test_singolare_con_un_solo_giorno_sopra_soglia(self):
        previsione = _previsione([("2026-08-11T12:00:00", 500)])

        [testo] = genera_suggerimenti_soglia(previsione, 300)

        assert "1 giorno " in testo
        assert "1 giorni" not in testo

    def test_plurale_con_piu_giorni_sopra_soglia(self):
        previsione = _previsione(
            [("2026-08-11T12:00:00", 500), ("2026-08-12T12:00:00", 600), ("2026-08-13T12:00:00", 700)]
        )

        [testo] = genera_suggerimenti_soglia(previsione, 300)

        assert "3 giorni" in testo

    def test_identifica_il_giorno_col_picco_piu_alto_non_il_primo_sopra_soglia(self):
        previsione = _previsione(
            [("2026-08-11T12:00:00", 400), ("2026-08-12T12:00:00", 900)]  # il 12 è il picco, non il primo (11)
        )

        [testo] = genera_suggerimenti_soglia(previsione, 300)

        assert "12/08" in testo
        assert "900W" in testo

    def test_include_il_valore_della_soglia_impostata_nel_testo(self):
        previsione = _previsione([("2026-08-11T12:00:00", 500)])

        [testo] = genera_suggerimenti_soglia(previsione, 250)

        assert "250W" in testo


class TestGeneraSuggerimentiAnomalie:
    def test_nessun_suggerimento_se_il_dataframe_e_vuoto(self):
        vuoto = pd.DataFrame(columns=["ds", "y", "punteggio"])

        assert genera_suggerimenti_anomalie(vuoto) == []

    def test_menziona_il_conteggio_e_la_piu_marcata_prima_riga_gia_ordinata(self):
        anomalie = pd.DataFrame(
            [
                {"ds": pd.Timestamp("2026-08-06T14:00:00", tz="Europe/Rome"), "y": 900.0, "punteggio": -0.72},
                {"ds": pd.Timestamp("2026-08-09T03:00:00", tz="Europe/Rome"), "y": 780.5, "punteggio": -0.41},
            ]
        )

        [testo] = genera_suggerimenti_anomalie(anomalie)

        assert "2 consumi" in testo
        assert "900W" in testo  # la prima riga (più anomala), non la seconda


class TestGeneraTuttiISuggerimenti:
    def test_combina_soglia_e_anomalie_nellordine_giusto(self):
        previsione = _previsione([("2026-08-11T12:00:00", 500)])
        anomalie = pd.DataFrame(
            [{"ds": pd.Timestamp("2026-08-06T14:00:00", tz="Europe/Rome"), "y": 900.0, "punteggio": -0.72}]
        )

        risultato = genera_tutti_i_suggerimenti(previsione, 300, anomalie)

        assert len(risultato) == 2
        assert "soglia" in risultato[0]
        assert "consumi" in risultato[1]

    def test_lista_vuota_se_ne_soglia_ne_anomalie_producono_suggerimenti(self):
        previsione = _previsione([("2026-08-11T12:00:00", 100)])
        vuoto = pd.DataFrame(columns=["ds", "y", "punteggio"])

        assert genera_tutti_i_suggerimenti(previsione, 300, vuoto) == []