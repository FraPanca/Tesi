"""Suggerimenti di risparmio: due fonti combinate.

1. Soglia utente + proiezione del trend: riusa deliberatamente Presa.sogliaPotenza, lo stesso campo gia' usato
    dal backend per lo spegnimento automatico non un secondo meccanismo di soglia separato.
2. Anomalie recenti rilevate da models/anomaly_detection.py.
"""

_GIORNI_ITALIANO = ["lunedi'", "martedi'", "mercoledi'", "giovedi'", "venerdi'", "sabato", "domenica"]


def _nome_giorno(data):
    return _GIORNI_ITALIANO[data.weekday()]


def genera_suggerimenti_soglia(previsione_df, soglia_potenza):
    # previsione_df: output di forecast.predict.genera_previsione() (colonne ds, yhat, ...).
    # soglia_potenza: Presa.sogliaPotenza, può essere None se l'utente non l'ha impostata.
    if soglia_potenza is None:
        return []

    aggregato_giornaliero = (
        previsione_df.assign(giorno=previsione_df["ds"].dt.date).groupby("giorno")["yhat"].mean()
    )

    giorni_a_rischio = aggregato_giornaliero[aggregato_giornaliero > soglia_potenza]
    if giorni_a_rischio.empty:
        return []

    giorno_peggiore = giorni_a_rischio.idxmax()
    n_giorni = len(giorni_a_rischio)
    plurale = "giorno" if n_giorni == 1 else "giorni"
    return [
        f"Il consumo medio previsto supera la soglia impostata ({soglia_potenza:.0f}W) in "
        f"{n_giorni} {plurale} nella prossima settimana, con il picco previsto "
        f"{_nome_giorno(giorno_peggiore)} {giorno_peggiore.strftime('%d/%m')} "
        f"({aggregato_giornaliero[giorno_peggiore]:.0f}W medi)."
    ]


def genera_suggerimenti_anomalie(anomalie_df):
    """anomalie_df: output di models.anomaly_detection.rileva_anomalie(), gia' ordinato dal
    piu' anomalo al meno anomalo."""
    if anomalie_df.empty:
        return []

    piu_anomala = anomalie_df.iloc[0]
    return [
        f"Rilevati {len(anomalie_df)} consumi fuori dal pattern abituale nell'ultima "
        f"settimana, il piu' marcato {_nome_giorno(piu_anomala['ds'].date())} "
        f"{piu_anomala['ds'].strftime('%d/%m alle %H:%M')} ({piu_anomala['y']:.0f}W)."
    ]


def genera_tutti_i_suggerimenti(previsione_df, soglia_potenza, anomalie_df):
    return genera_suggerimenti_soglia(previsione_df, soglia_potenza) + genera_suggerimenti_anomalie(
        anomalie_df
    )
