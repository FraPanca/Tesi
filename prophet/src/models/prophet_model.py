"""Training del modello Prophet - un modello per presa, non un modello aggregato: i profili di consumo
(basso consumo continuo tipo lampada/caricatore vs alto consumo intermittente tipo microonde) sono troppo
diversi per un unico modello."""

from prophet import Prophet
 
 
def addestra(serie, holidays_df=None):
    """yearly_seasonality=False: con poche settimane di dati non c'è storico sufficiente perché
    Prophet la stimi in modo sensato - da attivare quando la raccolta copre piu' mesi."""
    serie_naive = serie.assign(ds=serie["ds"].dt.tz_localize(None))
    holidays_naive = None
    if holidays_df is not None:
        holidays_naive = holidays_df.assign(ds=holidays_df["ds"].dt.tz_localize(None))
 
    modello = Prophet(
        growth="linear",
        yearly_seasonality=False,
        weekly_seasonality=True,
        daily_seasonality=True,
        holidays=holidays_naive,
    )
    modello.fit(serie_naive)
    return modello
