import pandas as pd

from testutils import ProphetFittizio
from models import prophet_model


def test_addestra_accetta_ds_tz_aware_senza_sollevare_eccezioni(serie_oraria_tzaware):
    # Il Prophet vero solleva ValueError su ds tz-aware: il fittizio replica questo comportamento,
    # quindi se addestra() non spoglia il tz prima di chiamare fit(), questo test fallisce.
    serie = serie_oraria_tzaware("2026-08-01T00:00:00", 24)

    modello = prophet_model.addestra(serie)

    assert modello is not None


def test_la_serie_passata_a_fit_e_naive_non_tz_aware(serie_oraria_tzaware):
    serie = serie_oraria_tzaware("2026-08-01T00:00:00", 24)

    prophet_model.addestra(serie)

    serie_fit = ProphetFittizio.ultima_istanza.serie_fit
    assert serie_fit["ds"].dt.tz is None


def test_la_serie_naive_passata_a_fit_ha_gli_stessi_valori_ds_della_serie_originale_senza_tz(serie_oraria_tzaware):
    serie = serie_oraria_tzaware("2026-08-01T00:00:00", 3)

    prophet_model.addestra(serie)

    serie_fit = ProphetFittizio.ultima_istanza.serie_fit
    attesi = serie["ds"].dt.tz_localize(None)
    pd.testing.assert_series_equal(serie_fit["ds"], attesi)


def test_holidays_df_tz_aware_viene_anch_esso_spogliato_prima_del_fit(serie_oraria_tzaware):
    serie = serie_oraria_tzaware("2026-08-01T00:00:00", 24)
    holidays_df = pd.DataFrame(
        {
            "holiday": ["Vacanza agosto 2026"],
            "ds": pd.to_datetime(["2026-08-01"]).tz_localize("Europe/Rome"),
        }
    )

    modello = prophet_model.addestra(serie, holidays_df)

    assert modello is not None
    holidays_fit = ProphetFittizio.ultima_istanza.kwargs["holidays"]
    assert holidays_fit["ds"].dt.tz is None


def test_senza_holidays_df_prophet_viene_costruito_con_holidays_none(serie_oraria_tzaware):
    serie = serie_oraria_tzaware("2026-08-01T00:00:00", 24)

    prophet_model.addestra(serie)

    assert ProphetFittizio.ultima_istanza.kwargs["holidays"] is None


def test_configurazione_stagionalita_e_growth(serie_oraria_tzaware):
    serie = serie_oraria_tzaware("2026-08-01T00:00:00", 24)

    prophet_model.addestra(serie)

    kwargs = ProphetFittizio.ultima_istanza.kwargs
    assert kwargs["growth"] == "linear"
    assert kwargs["yearly_seasonality"] is False
    assert kwargs["weekly_seasonality"] is True
    assert kwargs["daily_seasonality"] is True