from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd
import pytest

from data import interruzioni

TZ = ZoneInfo("Europe/Rome")


def _scrivi_yaml(tmp_path, contenuto):
    percorso = tmp_path / "interruzioni.yaml"
    percorso.write_text(contenuto, encoding="utf-8")
    return percorso


def _serie_oraria(inizio_iso, fine_iso, valore=10.0):
    indice = pd.date_range(inizio_iso, fine_iso, freq="h", tz="Europe/Rome")
    return pd.DataFrame({"ds": indice, "y": [valore] * len(indice)})


class TestCaricaInterruzioni:
    def test_filtra_per_presa_specifica(self, tmp_path, monkeypatch):
        yaml_contenuto = """
interruzioni:
  - nome: "Vacanza presa1"
    presa: "presa1"
    tipo: evento_speciale
    da: "2026-08-01"
    a: "2026-08-08"
  - nome: "Manutenzione presa2"
    presa: "presa2"
    tipo: assenza_vera
    da: "2026-09-01"
    a: "2026-09-02"
"""
        monkeypatch.setattr(interruzioni, "INTERRUZIONI_FILE", _scrivi_yaml(tmp_path, yaml_contenuto))

        risultato = interruzioni.carica_interruzioni("presa1")

        assert len(risultato) == 1
        assert risultato[0]["nome"] == "Vacanza presa1"

    def test_include_le_interruzioni_con_presa_tutte_indipendentemente_dal_presa_id(self, tmp_path, monkeypatch):
        yaml_contenuto = """
interruzioni:
  - nome: "Blackout generale"
    presa: "tutte"
    tipo: assenza_vera
    da: "2026-09-01"
    a: "2026-09-02"
"""
        monkeypatch.setattr(interruzioni, "INTERRUZIONI_FILE", _scrivi_yaml(tmp_path, yaml_contenuto))

        for presa_id in ("presa1", "presa2", "qualunque"):
            risultato = interruzioni.carica_interruzioni(presa_id)
            assert len(risultato) == 1
            assert risultato[0]["nome"] == "Blackout generale"

    def test_date_convertite_correttamente_in_europe_rome(self, tmp_path, monkeypatch):
        yaml_contenuto = """
interruzioni:
  - nome: "Test"
    presa: "presa1"
    tipo: assenza_vera
    da: "2026-08-01"
    a: "2026-08-03"
"""
        monkeypatch.setattr(interruzioni, "INTERRUZIONI_FILE", _scrivi_yaml(tmp_path, yaml_contenuto))

        risultato = interruzioni.carica_interruzioni("presa1")

        assert risultato[0]["da"] == datetime(2026, 8, 1, tzinfo=TZ)

    def test_estremo_a_e_esposto_come_00_00_del_giorno_successivo_allultimo_dichiarato(self, tmp_path, monkeypatch):
        # "a: 2026-08-08" nel file (inclusiva, ultimo giorno) -> esposta internamente come 2026-08-09 00:00,
        # il primo istante NON più incluso, per poter usare confronti [da, a) senza off-by-one.
        yaml_contenuto = """
interruzioni:
  - nome: "Test"
    presa: "presa1"
    tipo: assenza_vera
    da: "2026-08-01"
    a: "2026-08-08"
"""
        monkeypatch.setattr(interruzioni, "INTERRUZIONI_FILE", _scrivi_yaml(tmp_path, yaml_contenuto))

        risultato = interruzioni.carica_interruzioni("presa1")

        assert risultato[0]["a"] == datetime(2026, 8, 9, tzinfo=TZ)

    def test_nessuna_interruzione_dichiarata_ritorna_lista_vuota(self, tmp_path, monkeypatch):
        monkeypatch.setattr(interruzioni, "INTERRUZIONI_FILE", _scrivi_yaml(tmp_path, "interruzioni: []\n"))

        assert interruzioni.carica_interruzioni("presa1") == []


class TestApplicaAssenze:
    def test_assenza_vera_produce_nan_esattamente_nellintervallo_dichiarato_bordi_inclusi_esclusi(self):
        serie = _serie_oraria("2026-08-01T00:00:00", "2026-08-01T05:00:00")
        interr = [{"nome": "Test", "tipo": "assenza_vera", "da": datetime(2026, 8, 1, 2, tzinfo=TZ), "a": datetime(2026, 8, 1, 4, tzinfo=TZ)}]

        risultato = interruzioni.applica_assenze(serie, interr)

        per_ora = dict(zip(risultato["ds"].dt.hour, risultato["y"]))
        assert per_ora[1] == 10.0  # prima dell'intervallo: invariato
        assert pd.isna(per_ora[2])  # bordo "da": incluso, NaN
        assert pd.isna(per_ora[3])  # dentro l'intervallo: NaN
        assert per_ora[4] == 10.0  # bordo "a": ESCLUSO, valore originale
        assert per_ora[5] == 10.0  # dopo l'intervallo: invariato

    def test_evento_speciale_non_modifica_y(self):
        # Distinzione centrale del progetto: un evento_speciale NON deve mai toccare 'y'.
        serie = _serie_oraria("2026-08-01T00:00:00", "2026-08-01T05:00:00")
        interr = [{"nome": "Vacanza", "tipo": "evento_speciale", "da": datetime(2026, 8, 1, 1, tzinfo=TZ), "a": datetime(2026, 8, 1, 4, tzinfo=TZ)}]

        risultato = interruzioni.applica_assenze(serie, interr)

        assert (risultato["y"] == serie["y"]).all()

    def test_non_modifica_la_serie_originale(self):
        serie = _serie_oraria("2026-08-01T00:00:00", "2026-08-01T02:00:00")
        interr = [{"nome": "Test", "tipo": "assenza_vera", "da": datetime(2026, 8, 1, 0, tzinfo=TZ), "a": datetime(2026, 8, 1, 3, tzinfo=TZ)}]

        interruzioni.applica_assenze(serie, interr)

        assert not serie["y"].isna().any()


class TestEscludiEventiSpeciali:
    def test_rimuove_le_righe_nella_finestra_di_un_evento_speciale(self):
        serie = _serie_oraria("2026-08-01T00:00:00", "2026-08-01T05:00:00")
        interr = [{"nome": "Vacanza", "tipo": "evento_speciale", "da": datetime(2026, 8, 1, 2, tzinfo=TZ), "a": datetime(2026, 8, 1, 4, tzinfo=TZ)}]

        risultato = interruzioni.escludi_eventi_speciali(serie, interr)

        assert list(risultato["ds"].dt.hour) == [0, 1, 4, 5]

    def test_NON_rimuove_le_righe_di_unassenza_vera_solo_evento_speciale(self):
        serie = _serie_oraria("2026-08-01T00:00:00", "2026-08-01T05:00:00")
        interr = [{"nome": "Manutenzione", "tipo": "assenza_vera", "da": datetime(2026, 8, 1, 2, tzinfo=TZ), "a": datetime(2026, 8, 1, 4, tzinfo=TZ)}]

        risultato = interruzioni.escludi_eventi_speciali(serie, interr)

        assert len(risultato) == len(serie)


class TestCostruisciHolidaysDf:
    def test_uninterruzione_di_n_giorni_produce_n_righe(self):
        # "01-08/08" (8 giorni di calendario, inclusiva) dichiarata come da=2026-08-01, a=2026-08-09 (esposta già +1gg).
        interr = [{"nome": "Vacanza", "tipo": "evento_speciale", "da": datetime(2026, 8, 1, tzinfo=TZ), "a": datetime(2026, 8, 9, tzinfo=TZ)}]

        df = interruzioni.costruisci_holidays_df(interr)

        assert len(df) == 8

    def test_confine_non_a_mezzanotte_non_genera_righe_parziali_o_sbagliate(self):
        # Vacanza dal pomeriggio del 01/08 alla mattina del 09/08, dichiarata nel file come 01-08/08
        # (quindi da=2026-08-01 00:00, a=2026-08-09 00:00 dopo il +1gg).
        interr = [{"nome": "Vacanza", "tipo": "evento_speciale", "da": datetime(2026, 8, 1, tzinfo=TZ), "a": datetime(2026, 8, 9, tzinfo=TZ)}]

        df = interruzioni.costruisci_holidays_df(interr)

        date_attese = [f"2026-08-{g:02d}" for g in range(1, 9)]  # 1..8 agosto, MAI il 9
        assert df["ds"].dt.strftime("%Y-%m-%d").tolist() == date_attese

    def test_nessuna_riga_se_non_ci_sono_eventi_speciali_ritorna_none(self):
        interr = [{"nome": "Manutenzione", "tipo": "assenza_vera", "da": datetime(2026, 8, 1, tzinfo=TZ), "a": datetime(2026, 8, 2, tzinfo=TZ)}]

        assert interruzioni.costruisci_holidays_df(interr) is None

    def test_lista_interruzioni_vuota_ritorna_none(self):
        assert interruzioni.costruisci_holidays_df([]) is None

    def test_colonne_attese_holiday_e_ds(self):
        interr = [{"nome": "Vacanza", "tipo": "evento_speciale", "da": datetime(2026, 8, 1, tzinfo=TZ), "a": datetime(2026, 8, 2, tzinfo=TZ)}]

        df = interruzioni.costruisci_holidays_df(interr)

        assert list(df.columns) == ["holiday", "ds"]
        assert df["holiday"].iloc[0] == "Vacanza"