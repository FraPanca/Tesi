from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from evaluation.cross_validation import cutoff_validi

TZ = ZoneInfo("Europe/Rome")
ORIZZONTE_ORE = 168  # 7 giorni, stesso valore di config.ORIZZONTE_ORE (evitato l'import per isolare il test dalla config)


def _serie(inizio_iso, fine_iso):
    indice = pd.date_range(inizio_iso, fine_iso, freq="h", tz="Europe/Rome")
    return pd.DataFrame({"ds": indice, "y": [10.0] * len(indice)})


def _cutoff(iso):
    return pd.Timestamp(iso, tz=TZ)


class TestStoricoMinimo:
    def test_scarta_un_cutoff_con_meno_di_storico_minimo_giorni_di_storico(self):
        serie = _serie("2026-08-01T00:00:00", "2026-09-01T00:00:00")
        cutoff = _cutoff("2026-08-05T00:00:00")  # solo 4 giorni di storico prima del cutoff (< 14)

        assert cutoff_validi(serie, [cutoff], [], ORIZZONTE_ORE) == []

    def test_accetta_un_cutoff_con_esattamente_storico_sufficiente(self):
        serie = _serie("2026-08-01T00:00:00", "2026-09-01T00:00:00")
        cutoff = _cutoff("2026-08-20T00:00:00")  # 19 giorni di storico prima del cutoff (>= 14)

        assert cutoff_validi(serie, [cutoff], [], ORIZZONTE_ORE) == [cutoff]


class TestSovrapposizioneInterruzioni:
    def test_scarta_un_cutoff_il_cui_orizzonte_si_sovrappone_a_unassenza_vera(self):
        serie = _serie("2026-08-01T00:00:00", "2026-09-15T00:00:00")
        cutoff = _cutoff("2026-08-20T00:00:00")
        interr = [{"tipo": "assenza_vera", "da": datetime(2026, 8, 21, tzinfo=TZ), "a": datetime(2026, 8, 22, tzinfo=TZ)}]

        assert cutoff_validi(serie, [cutoff], interr, ORIZZONTE_ORE) == []

    def test_scarta_un_cutoff_il_cui_orizzonte_si_sovrappone_a_un_evento_speciale(self):
        # A differenza del training (dove solo assenza_vera esclude), qui ANCHE evento_speciale esclude.
        serie = _serie("2026-08-01T00:00:00", "2026-09-15T00:00:00")
        cutoff = _cutoff("2026-08-20T00:00:00")
        interr = [{"tipo": "evento_speciale", "da": datetime(2026, 8, 21, tzinfo=TZ), "a": datetime(2026, 8, 22, tzinfo=TZ)}]

        assert cutoff_validi(serie, [cutoff], interr, ORIZZONTE_ORE) == []

    def test_accetta_un_cutoff_il_cui_orizzonte_non_tocca_nessuna_interruzione(self):
        serie = _serie("2026-08-01T00:00:00", "2026-09-15T00:00:00")
        cutoff = _cutoff("2026-08-20T00:00:00")
        interr = [{"tipo": "assenza_vera", "da": datetime(2026, 9, 1, tzinfo=TZ), "a": datetime(2026, 9, 2, tzinfo=TZ)}]

        assert cutoff_validi(serie, [cutoff], interr, ORIZZONTE_ORE) == [cutoff]

    def test_bordo_esatto_interruzione_che_finisce_esattamente_al_cutoff_NON_si_sovrappone(self):
        # interruzione "a" == cutoff: condizione di sovrapposizione è "cutoff < i['a']", quindi
        # a == cutoff -> NON sovrapposto (l'interruzione è già finita quando inizia l'orizzonte).
        serie = _serie("2026-08-01T00:00:00", "2026-09-15T00:00:00")
        cutoff = _cutoff("2026-08-20T00:00:00")
        interr = [{"tipo": "assenza_vera", "da": datetime(2026, 8, 19, tzinfo=TZ), "a": datetime(2026, 8, 20, tzinfo=TZ)}]

        assert cutoff_validi(serie, [cutoff], interr, ORIZZONTE_ORE) == [cutoff]

    def test_bordo_esatto_interruzione_che_inizia_esattamente_alla_fine_dellorizzonte_NON_si_sovrappone(self):
        # interruzione "da" == fine_orizzonte: condizione è "fine_orizzonte > i['da']", quindi
        # da == fine_orizzonte -> NON sovrapposto.
        serie = _serie("2026-08-01T00:00:00", "2026-09-15T00:00:00")
        cutoff = _cutoff("2026-08-20T00:00:00")
        fine_orizzonte = cutoff + timedelta(hours=ORIZZONTE_ORE)
        interr = [{"tipo": "assenza_vera", "da": fine_orizzonte, "a": fine_orizzonte + timedelta(days=1)}]

        assert cutoff_validi(serie, [cutoff], interr, ORIZZONTE_ORE) == [cutoff]

    def test_sovrapposizione_di_un_solo_istante_dentro_lorizzonte_esclude_il_cutoff(self):
        serie = _serie("2026-08-01T00:00:00", "2026-09-15T00:00:00")
        cutoff = _cutoff("2026-08-20T00:00:00")
        fine_orizzonte = cutoff + timedelta(hours=ORIZZONTE_ORE)
        # L'interruzione inizia un'ora prima della fine dell'orizzonte: sovrapposizione reale di un'ora.
        interr = [{"tipo": "assenza_vera", "da": fine_orizzonte - timedelta(hours=1), "a": fine_orizzonte + timedelta(days=1)}]

        assert cutoff_validi(serie, [cutoff], interr, ORIZZONTE_ORE) == []


class TestMultiCutoff:
    def test_filtra_indipendentemente_ogni_cutoff_candidato(self):
        serie = _serie("2026-08-01T00:00:00", "2026-10-01T00:00:00")
        cutoff_valido = _cutoff("2026-08-20T00:00:00")
        cutoff_troppo_presto = _cutoff("2026-08-05T00:00:00")

        risultato = cutoff_validi(serie, [cutoff_troppo_presto, cutoff_valido], [], ORIZZONTE_ORE)

        assert risultato == [cutoff_valido]