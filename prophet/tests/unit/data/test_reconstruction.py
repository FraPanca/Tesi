import numpy as np
import pandas as pd

from data import reconstruction


def _df(righe):
    df = pd.DataFrame(righe)
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.tz_localize("Europe/Rome")
    return df


class TestDeduplica:
    def test_righe_con_timestamp_duplicato_e_valori_identici_sopravvive_una_sola_riga(self):
        df = _df(
            [
                {"timestamp": "2026-08-01T10:00:00", "potenza": 42.0},
                {"timestamp": "2026-08-01T10:00:00", "potenza": 42.0},
                {"timestamp": "2026-08-01T11:00:00", "potenza": 10.0},
            ]
        )

        risultato = reconstruction.deduplica(df)

        assert len(risultato) == 2
        assert risultato["timestamp"].tolist() == sorted(risultato["timestamp"].tolist())

    def test_duplicati_con_valori_diversi_sopravvive_il_primo_incontrato_keep_first(self):
        # Comportamento non esplicitamente atteso ma da verificare esplicitamente (drop_duplicates(keep="first")):
        # sopravvive il primo per ORDINE DI ARRIVO nel DataFrame originale, non necessariamente il cronologicamente primo.
        df = _df(
            [
                {"timestamp": "2026-08-01T10:00:00", "potenza": 42.0},
                {"timestamp": "2026-08-01T10:00:00", "potenza": 99.0},
            ]
        )

        risultato = reconstruction.deduplica(df)

        assert len(risultato) == 1
        assert risultato["potenza"].iloc[0] == 42.0

    def test_ordina_per_timestamp_anche_se_il_df_originale_non_e_ordinato(self):
        df = _df(
            [
                {"timestamp": "2026-08-01T12:00:00", "potenza": 3.0},
                {"timestamp": "2026-08-01T10:00:00", "potenza": 1.0},
                {"timestamp": "2026-08-01T11:00:00", "potenza": 2.0},
            ]
        )

        risultato = reconstruction.deduplica(df)

        assert risultato["potenza"].tolist() == [1.0, 2.0, 3.0]

    def test_reindicizza_da_zero(self):
        df = _df(
            [
                {"timestamp": "2026-08-01T12:00:00", "potenza": 3.0},
                {"timestamp": "2026-08-01T10:00:00", "potenza": 1.0},
            ]
        )

        risultato = reconstruction.deduplica(df)

        assert risultato.index.tolist() == [0, 1]


class TestCostruisciGrigliaOraria:
    def test_REGRESSIONE_un_punto_prende_il_valore_della_lettura_successiva_mai_della_precedente(self):
        # Segnale sintetico noto, orari NON allineati alla griglia: potenza=100 valida fino alle 10:40 (esclusa,
        # il worker apre il gruppo successivo a quell'istante), poi potenza=200 fino a fine finestra.
        df = _df(
            [
                {"timestamp": "2026-08-01T10:40:00", "potenza": 100.0},
                {"timestamp": "2026-08-01T12:15:00", "potenza": 200.0},
            ]
        )
        inizio = pd.Timestamp("2026-08-01T10:00:00", tz="Europe/Rome")
        fine = pd.Timestamp("2026-08-01T13:00:00", tz="Europe/Rome")

        griglia = reconstruction.costruisci_griglia_oraria(df, inizio, fine)

        attesi = {
            "2026-08-01T10:00:00": 100.0,  # prossima lettura (10:40) -> 100
            "2026-08-01T11:00:00": 200.0,  # prossima lettura (12:15) -> 200, MAI 100 (che sarebbe un ffill/bfill sbagliato)
            "2026-08-01T12:00:00": 200.0,  # prossima lettura (12:15) -> 200
        }
        per_ora = dict(zip(griglia["ds"].dt.strftime("%Y-%m-%dT%H:%M:%S"), griglia["y"]))
        for ora, atteso in attesi.items():
            assert per_ora[ora] == atteso, f"punto griglia {ora}"

    def test_caso_limite_nessuna_lettura_futura_disponibile_produce_nan(self):
        df = _df([{"timestamp": "2026-08-01T09:00:00", "potenza": 100.0}])
        inizio = pd.Timestamp("2026-08-01T10:00:00", tz="Europe/Rome")  # dopo l'unica lettura disponibile
        fine = pd.Timestamp("2026-08-01T11:00:00", tz="Europe/Rome")

        griglia = reconstruction.costruisci_griglia_oraria(df, inizio, fine)

        assert griglia["y"].isna().all()

    def test_griglia_oraria_regolare_tra_inizio_e_fine_inclusi(self):
        df = _df([{"timestamp": "2026-08-01T09:00:00", "potenza": 1.0}])
        inizio = pd.Timestamp("2026-08-01T00:00:00", tz="Europe/Rome")
        fine = pd.Timestamp("2026-08-01T03:00:00", tz="Europe/Rome")

        griglia = reconstruction.costruisci_griglia_oraria(df, inizio, fine)

        assert len(griglia) == 4  # 00,01,02,03 inclusi entrambi gli estremi
        assert (griglia["ds"].diff().dropna() == pd.Timedelta(hours=1)).all()

    def test_ds_della_griglia_e_tzaware_nello_stesso_fuso_dei_dati_di_input(self):
        df = _df([{"timestamp": "2026-08-01T09:00:00", "potenza": 1.0}])
        inizio = pd.Timestamp("2026-08-01T00:00:00", tz="Europe/Rome")
        fine = pd.Timestamp("2026-08-01T02:00:00", tz="Europe/Rome")

        griglia = reconstruction.costruisci_griglia_oraria(df, inizio, fine)

        assert str(griglia["ds"].dt.tz) == "Europe/Rome"