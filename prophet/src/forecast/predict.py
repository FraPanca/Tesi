"""Genera un'unica previsione a 168h (7 giorni) e non due modelli separati o due chiamate.

Prophet lavora internamente con timestamp naive. Qui viene costruito l'orizzonte futuro in modo tz-aware
corretto fin dall'inizio (pandas gestisce da solo i cambi di ora legale quando si passa tz= a pd.date_range),
lo passiamo a predict() spogliato del timezone solo per compatibilità, e infine sostituiamo il 'ds' naive
restituito da Prophet con la nostra sequenza tz-aware originale (stesso ordine, stessa lunghezza: predict()
ritorna una riga per ogni riga di input, nello stesso ordine)."""

import pandas as pd
 
from config import ORIZZONTE_ORE
 
 
def genera_previsione(modello, ultimo_ds):
    orizzonte_tz = pd.date_range(ultimo_ds + pd.Timedelta(hours=1), periods=ORIZZONTE_ORE, freq="h")
    futuro = pd.DataFrame({"ds": orizzonte_tz.tz_localize(None)})
    previsione = modello.predict(futuro)
    previsione = previsione.assign(
        ds=orizzonte_tz,
        yhat=previsione["yhat"].clip(lower=0),
        yhat_lower=previsione["yhat_lower"].clip(lower=0),
        yhat_upper=previsione["yhat_upper"].clip(lower=0),
    )
    return previsione[["ds", "yhat", "yhat_lower", "yhat_upper"]]