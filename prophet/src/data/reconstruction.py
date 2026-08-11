"""Ricostruzione di una griglia oraria regolare a partire dagli eventi 'optimized' irregolari pubblicati dal worker ESP32.

Il worker apre il gruppo successivo appena chiude il precedente: potenza[i] è quindi valida sull'intervallo
(timestamp[i-1], timestamp[i]] (una funzione a gradini). Per un punto t sulla griglia, il valore corretto e' quello della
PROSSIMA lettura con timestamp >= t (mai la precedente: sarebbe un forward-fill)."""

import pandas as pd


def deduplica(df):
    # Rimuove i timestamp duplicati.
    return (
        df.drop_duplicates(subset="timestamp", keep="first")
        .sort_values("timestamp")
        .reset_index(drop=True)
    )


def costruisci_griglia_oraria(df, inizio, fine):
    # df: colonne 'timestamp' (datetime tz-aware) e 'potenza' (W); inizio/fine: datetime tz-aware, estremi della griglia
    # oraria da ricostruire. Ritorna un DataFrame con colonne 'ds' (griglia oraria regolare) e 'y' (potenza), pronto per
    # l'applicazione delle interruzioni dichiarate (vedi interruzioni.py) e poi per Prophet.
    griglia = pd.DataFrame({"ds": pd.date_range(inizio, fine, freq="h", tz=df["timestamp"].dt.tz)})

    ricostruito = pd.merge_asof(
        griglia,
        df.rename(columns={"timestamp": "ds", "potenza": "y"})[["ds", "y"]],
        on="ds",
        direction="forward",
    )

    return ricostruito
