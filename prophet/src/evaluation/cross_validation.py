"""Cross-validation rolling-origin con cutoff scelti manualmente, scartando quelli il cui orizzonte di valutazione
cade dentro un'interruzione nota: di qualsiasi tipo, assenza_vera o evento_speciale (a differenza del training, dove
solo l'assenza_vera viene esclusa: l'evento_speciale resta nei dati ma gonfierebbe artificialmente l'errore se finisse
nella finestra di valutazione). Storico minimo prima del primo cutoff: 14 giorni, non un semplice multiplo dell'orizzonte,
 necessario per la stagionalita' settimanale, confermato da un avviso reale di Prophet durante un test con storico
 insufficiente. Confronto a sovrapposizione fra intervalli, non a margine fisso."""

from datetime import timedelta
 
import pandas as pd
 
from config import STORICO_MINIMO_GIORNI
from evaluation import baseline, metrics
from forecast import predict as forecast_predict
from models import prophet_model
 
 
def cutoff_validi(serie, cutoff_candidati, interruzioni, orizzonte_ore):
    validi = []
    for cutoff in cutoff_candidati:
        storico = serie[serie["ds"] < cutoff]
        if storico.empty or (cutoff - storico["ds"].min()) < timedelta(days=STORICO_MINIMO_GIORNI):
            continue
 
        fine_orizzonte = cutoff + timedelta(hours=orizzonte_ore)
        sovrapposizione = any(
            cutoff < i["a"] and fine_orizzonte > i["da"] for i in interruzioni
        )
        if sovrapposizione:
            continue
 
        validi.append(cutoff)
    return validi
 
 
def valuta_cutoff(serie, cutoff, holidays_df, orizzonte_ore):
    # Un singolo fold: fit su tutto lo storico prima del cutoff, confronto Prophet vs baseline sull'orizzonte successivo,
    # per due finestre separate (24h e 7gg interi): errori diversi per orizzonti diversi, non una media unica."""
    train = serie[serie["ds"] < cutoff].dropna(subset=["y"])
    reale = serie[(serie["ds"] >= cutoff) & (serie["ds"] < cutoff + timedelta(hours=orizzonte_ore))]
    reale = reale.dropna(subset=["y"]).sort_values("ds")
 
    modello = prophet_model.addestra(train, holidays_df)
    previsione = forecast_predict.genera_previsione(modello, train["ds"].max())
    previsione = previsione[previsione["ds"].isin(reale["ds"])].sort_values("ds")
 
    baseline_valori = baseline.previsione_media_mobile(train["y"], len(reale))
 
    righe = []
    for etichetta, ore in (("24h", 24), ("7gg", orizzonte_ore)):
        limite = cutoff + timedelta(hours=ore)
        finestra_reale = reale[reale["ds"] < limite]
        finestra_prev = previsione[previsione["ds"] < limite]
        finestra_baseline = baseline_valori[: len(finestra_reale)]
 
        if finestra_reale.empty:
            continue
 
        righe.append(
            {
                "cutoff": cutoff,
                "orizzonte": etichetta,
                "mae_prophet": metrics.mae(finestra_reale["y"], finestra_prev["yhat"]),
                "rmse_prophet": metrics.rmse(finestra_reale["y"], finestra_prev["yhat"]),
                "coverage_prophet": metrics.coverage(
                    finestra_reale["y"], finestra_prev["yhat_lower"], finestra_prev["yhat_upper"]
                ),
                "smape_prophet": metrics.smape(finestra_reale["y"], finestra_prev["yhat"]),
                "mae_baseline": metrics.mae(finestra_reale["y"], finestra_baseline),
                "rmse_baseline": metrics.rmse(finestra_reale["y"], finestra_baseline),
            }
        )
    return righe
 
 
def esegui(serie, cutoff_candidati, interruzioni, holidays_df, orizzonte_ore):
    validi = cutoff_validi(serie, cutoff_candidati, interruzioni, orizzonte_ore)
    righe = []
    for cutoff in validi:
        righe.extend(valuta_cutoff(serie, cutoff, holidays_df, orizzonte_ore))
    return pd.DataFrame(righe)
