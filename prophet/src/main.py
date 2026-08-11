"""Entrypoint di produzione: per ogni presa registrata, ricostruisce la serie, addestra
Prophet, genera la previsione a 168h e la pubblica sul backend.

Lanciato una volta al giorno da systemd/iot-prophet-forecast.timer via
"docker compose --profile jobs run --rm prophet". """

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
 
import pandas as pd
 
from config import STORICO_MINIMO_GIORNI, STORICO_RICHIESTO_GIORNI, TIMEZONE
from data import interruzioni, log_client, reconstruction, rest_client
from forecast import predict, rest_publisher, suggerimenti
from models import anomaly_detection, prophet_model
 
_TZ = ZoneInfo(TIMEZONE)
 
FINESTRA_ANOMALIE_GIORNI = 7  # anomalie rilevate solo sull'ultima settimana.
 
 
def elabora_presa(presa, presa_id):
    fine = datetime.now(_TZ).replace(minute=0, second=0, microsecond=0)
    inizio = fine - timedelta(days=STORICO_RICHIESTO_GIORNI)
 
    grezzi = rest_client.get_consumi(presa_id, inizio, fine)
    if not grezzi:
        raise ValueError("nessun dato disponibile per il periodo richiesto")
 
    df = pd.DataFrame(grezzi)[["timestamp", "potenza"]]
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True).dt.tz_convert(_TZ)
    df = reconstruction.deduplica(df)
 
    serie = reconstruction.costruisci_griglia_oraria(df, inizio, fine)
 
    interr = interruzioni.carica_interruzioni(presa_id)
    serie = interruzioni.applica_assenze(serie, interr)
    serie = serie.dropna(subset=["y"])
 
    copertura = serie["ds"].max() - serie["ds"].min()
    if pd.isna(copertura) or copertura < timedelta(days=STORICO_MINIMO_GIORNI):
        raise ValueError(
            f"storico utile insufficiente dopo le esclusioni "
            f"(< {STORICO_MINIMO_GIORNI} giorni)"
        )
 
    holidays_df = interruzioni.costruisci_holidays_df(interr)
    modello = prophet_model.addestra(serie, holidays_df)
    previsione = predict.genera_previsione(modello, serie["ds"].max())
 
    finestra_recente = serie[serie["ds"] >= fine - timedelta(days=FINESTRA_ANOMALIE_GIORNI)]
    finestra_recente = interruzioni.escludi_eventi_speciali(finestra_recente, interr)
    anomalie = anomaly_detection.rileva_anomalie(finestra_recente)
 
    testi_suggerimenti = suggerimenti.genera_tutti_i_suggerimenti(
        previsione, presa.get("sogliaPotenza"), anomalie
    )
 
    rest_publisher.pubblica_previsione(
        presa_id, previsione, suggerimenti=testi_suggerimenti, anomalie_df=anomalie
    )
 
 
def main():
    prese = rest_client.get_prese()
    if not prese:
        print("[prophet] nessuna presa registrata, niente da fare")
        return
 
    for presa in prese:
        presa_id = presa["presaId"]
        try:
            elabora_presa(presa, presa_id)
            print(f"[prophet] previsione pubblicata per {presa_id}")
        except Exception as errore:
            log_client.segnala_errore(
                evento="prophet.forecast_fallito",
                messaggio=str(errore),
                metadati={"presaId": presa_id},
            )
            print(f"[prophet] fallito per {presa_id}: {errore}")
 
 
if __name__ == "__main__":
    main()
