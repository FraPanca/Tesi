from zoneinfo import ZoneInfo

import pandas as pd
import pytest

from config import ORIZZONTE_ORE
from forecast import predict


class ModelloFittizio:
    """Sostituto di un Prophet addestrato: predict() ritorna yhat/yhat_lower/yhat_upper noti,
    incluso qualche valore negativo (osservato sui dati reali) per testare il clip a zero."""

    def __init__(self, yhat=None, yhat_lower=None, yhat_upper=None):
        self._yhat = yhat
        self._yhat_lower = yhat_lower
        self._yhat_upper = yhat_upper

    def predict(self, futuro):
        n = len(futuro)

        def adatta(valori, default):
            if valori is None:
                return [default] * n
            # Adatta a n righe: i valori espliciti vanno nelle prime posizioni, il resto è riempito col default.
            return list(valori) + [default] * (n - len(valori))

        yhat = adatta(self._yhat, 10.0)
        yhat_lower = adatta(self._yhat_lower, 5.0)
        yhat_upper = adatta(self._yhat_upper, 15.0)
        return pd.DataFrame(
            {
                "ds": futuro["ds"],  # naive, stesso ordine/lunghezza di 'futuro': comportamento reale di Prophet.predict()
                "yhat": yhat,
                "yhat_lower": yhat_lower,
                "yhat_upper": yhat_upper,
                "trend": [0.0] * n,  # colonna extra, come nel vero output di Prophet: non deve comparire nel risultato
            }
        )


def test_genera_esattamente_orizzonte_ore_righe():
    ultimo_ds = pd.Timestamp("2026-07-01T00:00:00", tz="Europe/Rome")
    previsione = predict.genera_previsione(ModelloFittizio(), ultimo_ds)

    assert len(previsione) == ORIZZONTE_ORE


def test_ds_risultante_e_tzaware_europe_rome_e_monotona():
    ultimo_ds = pd.Timestamp("2026-07-01T00:00:00", tz="Europe/Rome")
    previsione = predict.genera_previsione(ModelloFittizio(), ultimo_ds)

    assert str(previsione["ds"].dt.tz) == "Europe/Rome"
    assert previsione["ds"].is_monotonic_increasing


def test_ds_inizia_un_ora_dopo_ultimo_ds():
    ultimo_ds = pd.Timestamp("2026-07-01T00:00:00", tz="Europe/Rome")
    previsione = predict.genera_previsione(ModelloFittizio(), ultimo_ds)

    assert previsione["ds"].iloc[0] == ultimo_ds + pd.Timedelta(hours=1)


def test_ritorna_solo_le_quattro_colonne_attese():
    ultimo_ds = pd.Timestamp("2026-07-01T00:00:00", tz="Europe/Rome")
    previsione = predict.genera_previsione(ModelloFittizio(), ultimo_ds)

    assert list(previsione.columns) == ["ds", "yhat", "yhat_lower", "yhat_upper"]


def test_clip_a_zero_su_yhat_yhat_lower_yhat_upper_con_valori_negativi_noti():
    # Osservato sui dati reali (presa a basso consumo): yhat_lower poteva scendere sotto zero.
    ultimo_ds = pd.Timestamp("2026-07-01T00:00:00", tz="Europe/Rome")
    modello = ModelloFittizio(yhat=[-2.0, 3.0], yhat_lower=[-5.0, -1.3], yhat_upper=[1.0, 8.0])

    previsione = predict.genera_previsione(modello, ultimo_ds)

    assert (previsione["yhat"] >= 0).all()
    assert (previsione["yhat_lower"] >= 0).all()
    assert (previsione["yhat_upper"] >= 0).all()
    assert previsione["yhat"].iloc[0] == 0.0
    assert previsione["yhat_lower"].iloc[1] == 0.0


@pytest.mark.parametrize(
    "inizio_iso,descrizione",
    [
        ("2026-10-24T12:00:00", "fine ora legale (25/10/2026): CEST -> CET"),
        ("2026-03-28T12:00:00", "inizio ora legale (29/03/2026): CET -> CEST"),
    ],
)
def test_attraversa_un_cambio_ora_legale_senza_eccezioni_168_righe_monotona(inizio_iso, descrizione):
    ultimo_ds = pd.Timestamp(inizio_iso, tz=ZoneInfo("Europe/Rome"))

    previsione = predict.genera_previsione(ModelloFittizio(), ultimo_ds)

    assert len(previsione) == ORIZZONTE_ORE, descrizione
    assert previsione["ds"].is_monotonic_increasing, descrizione
    assert not previsione["ds"].isna().any(), descrizione